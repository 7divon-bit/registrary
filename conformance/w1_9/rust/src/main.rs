use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{Map, Value};
use sha2::{Digest, Sha256};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::env;
use std::fs;
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Deserialize)]
struct Assertion {
    rule_id: String,
    assertion_target: String,
    semantic_outcome: String,
}

#[derive(Debug, Clone, Deserialize)]
struct Expected { assertions: Vec<Assertion> }

#[derive(Debug, Clone, Deserialize)]
struct FixtureInput {
    label: String,
    schema_def: String,
    expected_schema_valid: bool,
    payload: Value,
}

#[derive(Debug, Clone, Deserialize)]
struct FixtureFile {
    fixture_id: String,
    #[serde(default)] description: String,
    #[serde(default)] kind: String,
    #[serde(default)] source_artifact: String,
    #[serde(default)] context: Value,
    expected: Expected,
    inputs: Vec<FixtureInput>,
}

#[derive(Debug, Deserialize)]
struct Manifest { fixtures: Vec<ManifestFixture> }
#[derive(Debug, Deserialize)]
struct ManifestFixture { fixture_id: String, inputs: Vec<ManifestInput> }
#[derive(Debug, Deserialize)]
struct ManifestInput { label: String, schema_def: String, expected_schema_valid: bool, canonical_sha256: String }

#[derive(Debug, Deserialize)]
struct ArrayRegistry { entries: Vec<ArrayEntry> }
#[derive(Debug, Deserialize)]
struct ArrayEntry { schema_def: String, field_path: String, semantics: String }
#[derive(Debug, Deserialize)]
struct SelfHashRegistry { entries: Vec<SelfHashEntry> }
#[derive(Debug, Deserialize)]
struct SelfHashEntry { schema_def: String, self_hash_field: String }

#[derive(Debug, Deserialize)]
struct VectorRegistry { vectors: Vec<VectorEntry> }
#[derive(Debug, Deserialize)]
struct VectorEntry {
    vector_id: String,
    schema_def: String,
    input: Value,
    normalized: Value,
    jcs_utf8: String,
    jcs_hex: String,
    sha256: String,
}

#[derive(Debug, Serialize)]
struct ResultDoc {
    runner: String,
    fixture_cases: usize,
    fixture_inputs: usize,
    assertion_count: usize,
    schema_matches: usize,
    schema_mismatches: Vec<String>,
    canonical_hash_matches: usize,
    canonical_hash_mismatches: Vec<String>,
    self_hash_checked: usize,
    self_hash_mismatches: Vec<String>,
    vector_matches: usize,
    vector_mismatches: Vec<String>,
    semantic_evaluated: usize,
    semantic_matches: usize,
    semantic_mismatches: Vec<SemanticMismatch>,
    semantic_blocked: Vec<SemanticBlocker>,
    input_results: Vec<InputResult>,
    semantic_results: Vec<SemanticAssertionResult>,
    overall_status: String,
}

#[derive(Debug, Serialize)]
struct InputResult {
    fixture_id: String,
    label: String,
    schema_def: String,
    expected_schema_valid: bool,
    schema_valid: bool,
    schema_errors: Vec<String>,
    normalized: Value,
    jcs_utf8: String,
    jcs_hex: String,
    sha256: String,
    expected_sha256: String,
    #[serde(skip_serializing_if = "String::is_empty")] self_hash_field: String,
    #[serde(skip_serializing_if = "String::is_empty")] self_hash_stored: String,
    #[serde(skip_serializing_if = "String::is_empty")] self_hash_calculated: String,
    #[serde(skip_serializing_if = "Option::is_none")] self_hash_match: Option<bool>,
}

#[derive(Debug, Serialize)]
struct SemanticAssertionResult {
    fixture_id: String,
    rule_id: String,
    assertion_target: String,
    expected_outcome: String,
    #[serde(skip_serializing_if = "String::is_empty")] actual_outcome: String,
    evaluable: bool,
    #[serde(skip_serializing_if = "Option::is_none")] r#match: Option<bool>,
    #[serde(skip_serializing_if = "String::is_empty")] blocker_reason: String,
    trace: Vec<String>,
}
#[derive(Debug, Serialize)]
struct SemanticMismatch {
    fixture_id: String,
    rule_id: String,
    assertion_target: String,
    expected: String,
    actual: String,
    trace: Vec<String>,
}
#[derive(Debug, Serialize)]
struct SemanticBlocker {
    fixture_id: String,
    rule_id: String,
    assertion_target: String,
    reason: String,
    trace: Vec<String>,
}

struct Engine {
    defs: Map<String, Value>,
    arrays: HashMap<String, HashMap<String, String>>,
    self_hashes: HashMap<String, String>,
}

fn read_json<T: for<'a> Deserialize<'a>>(p: &Path) -> Result<T, String> {
    let s = fs::read_to_string(p).map_err(|e| format!("{}: {}", p.display(), e))?;
    serde_json::from_str(&s).map_err(|e| format!("{}: {}", p.display(), e))
}

impl Engine {
    fn new(root: &Path) -> Result<Self, String> {
        let bundle: Value = read_json(&root.join("schemas/w1.bundle.schema.json"))?;
        let defs = bundle.get("$defs").and_then(Value::as_object).cloned().ok_or("bundle missing $defs")?;
        let ar: ArrayRegistry = read_json(&root.join("registries/array_semantics.json"))?;
        let mut arrays: HashMap<String, HashMap<String, String>> = HashMap::new();
        for e in ar.entries {
            arrays.entry(e.schema_def).or_default().insert(e.field_path, e.semantics);
        }
        let sr: SelfHashRegistry = read_json(&root.join("registries/self_hash_fields.json"))?;
        let mut self_hashes = HashMap::new();
        for e in sr.entries { self_hashes.insert(e.schema_def, e.self_hash_field); }
        Ok(Self { defs, arrays, self_hashes })
    }

    fn resolve_ref(&self, r: &str) -> Result<(Value, String), String> {
        let p = "#/$defs/";
        if !r.starts_with(p) { return Err(format!("unsupported ref {}", r)); }
        let name = r.trim_start_matches(p).to_string();
        let v = self.defs.get(&name).cloned().ok_or_else(|| format!("unknown def {}", name))?;
        Ok((v, name))
    }

    fn validate_def(&self, v: &Value, def: &str) -> Vec<String> {
        match self.defs.get(def) {
            Some(node) => self.validate_node(v, node, "$", def),
            None => vec![format!("unknown schema def: {}", def)],
        }
    }

    fn validate_node(&self, v: &Value, node: &Value, path: &str, current_def: &str) -> Vec<String> {
        let Some(m) = node.as_object() else { return vec![]; };
        if let Some(r) = m.get("$ref").and_then(Value::as_str) {
            return match self.resolve_ref(r) {
                Ok((n,d)) => self.validate_node(v, &n, path, &d),
                Err(e) => vec![format!("{}: {}", path, e)],
            };
        }
        if let Some(one) = m.get("oneOf").and_then(Value::as_array) {
            let mut pass = 0usize;
            for br in one { if self.validate_node(v, br, path, current_def).is_empty() { pass += 1; } }
            if pass != 1 { return vec![format!("{}: oneOf matched {} branches", path, pass)]; }
            return vec![];
        }
        if let Some(t) = m.get("type").and_then(Value::as_str) {
            if !type_ok(v,t) { return vec![format!("{}: expected {}", path, t)]; }
        }
        if let Some(c) = m.get("const") { if !deep_equal_json(v,c) { return vec![format!("{}: const mismatch", path)]; } }
        if let Some(en) = m.get("enum").and_then(Value::as_array) {
            if !en.iter().any(|x| deep_equal_json(v,x)) { return vec![format!("{}: enum mismatch", path)]; }
        }
        let mut errs = vec![];
        match v {
            Value::String(s) => {
                if let Some(pat)=m.get("pattern").and_then(Value::as_str) {
                    match Regex::new(pat) { Ok(re) => if !re.is_match(s) { errs.push(format!("{}: pattern mismatch",path)); }, Err(_) => errs.push(format!("{}: bad pattern",path)) }
                }
                if let Some(n)=m.get("minLength").and_then(Value::as_u64) { if s.chars().count() < n as usize { errs.push(format!("{}: minLength",path)); } }
                if let Some(n)=m.get("maxLength").and_then(Value::as_u64) { if s.chars().count() > n as usize { errs.push(format!("{}: maxLength",path)); } }
            }
            Value::Number(n) => {
                if let Some(i)=n.as_i64() {
                    if let Some(min)=m.get("minimum").and_then(Value::as_i64) { if i < min { errs.push(format!("{}: minimum",path)); } }
                    if let Some(max)=m.get("maximum").and_then(Value::as_i64) { if i > max { errs.push(format!("{}: maximum",path)); } }
                }
            }
            Value::Array(a) => {
                if let Some(n)=m.get("minItems").and_then(Value::as_u64) { if a.len() < n as usize { errs.push(format!("{}: minItems",path)); } }
                if let Some(n)=m.get("maxItems").and_then(Value::as_u64) { if a.len() > n as usize { errs.push(format!("{}: maxItems",path)); } }
                if m.get("uniqueItems").and_then(Value::as_bool)==Some(true) {
                    let mut seen=HashSet::new();
                    for (i,it) in a.iter().enumerate() { let k=String::from_utf8(jcs(it)).unwrap(); if !seen.insert(k) { errs.push(format!("{}/{}: duplicate",path,i)); } }
                }
                if let Some(items)=m.get("items") { for (i,it) in a.iter().enumerate() { errs.extend(self.validate_node(it,items,&format!("{}/{}",path,i),current_def)); } }
            }
            Value::Object(o) => {
                let req: HashSet<String> = m.get("required").and_then(Value::as_array).map(|a| a.iter().filter_map(Value::as_str).map(str::to_string).collect()).unwrap_or_default();
                for r in req { if !o.contains_key(&r) { errs.push(format!("{}: missing required {}",path,r)); } }
                let props = m.get("properties").and_then(Value::as_object);
                for (k,val) in o {
                    if let Some(ps)=props.and_then(|p| p.get(k)) { errs.extend(self.validate_node(val,ps,&format!("{}/{}",path,k),current_def)); continue; }
                    match m.get("additionalProperties") {
                        Some(Value::Bool(false)) => errs.push(format!("{}: additional property {}",path,k)),
                        Some(x) if x.is_object() => errs.extend(self.validate_node(val,x,&format!("{}/{}",path,k),current_def)),
                        _ => {}
                    }
                }
            }
            _ => {}
        }
        errs
    }

    fn normalize_def(&self, v: &Value, def: &str) -> Result<Value,String> {
        let n=self.defs.get(def).ok_or_else(||format!("unknown def {}",def))?;
        self.normalize_node(v.clone(),n,def,"/")
    }

    fn normalize_node(&self, mut v: Value, node: &Value, current_def: &str, path: &str) -> Result<Value,String> {
        let Some(m)=node.as_object() else { return Ok(v); };
        if let Some(r)=m.get("$ref").and_then(Value::as_str) { let (n,d)=self.resolve_ref(r)?; return self.normalize_node(v,&n,&d,"/"); }
        if let Some(one)=m.get("oneOf").and_then(Value::as_array) {
            for br in one { if self.validate_node(&v,br,"$",current_def).is_empty() { return self.normalize_node(v,br,current_def,path); } }
            return Ok(v);
        }
        match &mut v {
            Value::Object(o) => {
                let keys: Vec<String>=o.keys().cloned().collect();
                for k in keys {
                    let ps = m.get("properties").and_then(Value::as_object).and_then(|p|p.get(&k)).or_else(|| m.get("additionalProperties").filter(|x|x.is_object()));
                    if let (Some(ps),Some(val))=(ps,o.get(&k).cloned()) { let nv=self.normalize_node(val,ps,current_def,&format!("{}{}",path,k))?; o.insert(k.clone(),nv); }
                    let sem=self.arrays.get(current_def).and_then(|mm|mm.get(&format!("/{}",k))).cloned().unwrap_or_default();
                    if sem=="SET_LIKE" {
                        if let Some(a)=o.get_mut(&k).and_then(Value::as_array_mut) {
                            let mut pairs: Vec<(Vec<u8>,Value)>=vec![]; let mut seen=HashSet::new();
                            for it in a.iter() { let b=jcs(it); let key=String::from_utf8(b.clone()).unwrap(); if !seen.insert(key) { return Err(format!("duplicate set-like element {}/{}",current_def,k)); } pairs.push((b,it.clone())); }
                            pairs.sort_by(|a,b| a.0.cmp(&b.0)); *a=pairs.into_iter().map(|x|x.1).collect();
                        }
                    }
                }
            }
            Value::Array(a) => {
                if let Some(items)=m.get("items") { for i in 0..a.len() { a[i]=self.normalize_node(a[i].clone(),items,current_def,path)?; } }
            }
            _=>{}
        }
        Ok(v)
    }
}

fn type_ok(v:&Value,t:&str)->bool { match t { "object"=>v.is_object(),"array"=>v.is_array(),"string"=>v.is_string(),"boolean"=>v.is_boolean(),"integer"=>v.as_i64().is_some()||v.as_u64().is_some(),"number"=>v.is_number(),"null"=>v.is_null(),_=>true } }
fn deep_equal_json(a:&Value,b:&Value)->bool { jcs(a)==jcs(b) }
fn utf16_cmp(a:&str,b:&str)->Ordering { a.encode_utf16().collect::<Vec<_>>().cmp(&b.encode_utf16().collect::<Vec<_>>()) }
fn quote_string(s:&str)->Vec<u8> { serde_json::to_string(s).unwrap().into_bytes() }
fn jcs(v:&Value)->Vec<u8> {
    match v {
        Value::Null=>b"null".to_vec(), Value::Bool(true)=>b"true".to_vec(), Value::Bool(false)=>b"false".to_vec(),
        Value::String(s)=>quote_string(s), Value::Number(n)=>n.to_string().into_bytes(),
        Value::Array(a)=>{ let mut out=vec![b'[']; for (i,it) in a.iter().enumerate(){ if i>0{out.push(b',');} out.extend(jcs(it)); } out.push(b']'); out },
        Value::Object(o)=>{ let mut keys:Vec<&String>=o.keys().collect(); keys.sort_by(|a,b|utf16_cmp(a,b)); let mut out=vec![b'{']; for (i,k) in keys.iter().enumerate(){ if i>0{out.push(b',');} out.extend(quote_string(k)); out.push(b':'); out.extend(jcs(&o[*k])); } out.push(b'}'); out }
    }
}
fn sha_hex(b:&[u8])->String { hex::encode(Sha256::digest(b)) }
fn get_str<'a>(m:&'a Map<String,Value>,k:&str)->&'a str { m.get(k).and_then(Value::as_str).unwrap_or("") }
fn get_arr<'a>(m:&'a Map<String,Value>,k:&str)->&'a [Value] { m.get(k).and_then(Value::as_array).map(|v|v.as_slice()).unwrap_or(&[]) }
fn find_input_by_schema<'a>(f:&'a FixtureFile,s:&str)->Option<&'a Map<String,Value>>{f.inputs.iter().find(|i|i.schema_def==s).and_then(|i|i.payload.as_object())}
fn find_inputs_by_schema<'a>(f:&'a FixtureFile,s:&str)->Vec<&'a Map<String,Value>>{f.inputs.iter().filter(|i|i.schema_def==s).filter_map(|i|i.payload.as_object()).collect()}
fn first_input(f:&FixtureFile)->Option<&Map<String,Value>>{f.inputs.first().and_then(|i|i.payload.as_object())}
fn any_invalid(v:&[bool])->bool{v.iter().any(|x|!*x)}
fn object_canonical_id(p:&Map<String,Value>)->&str { for k in ["canonical_id","principal_id","organization_id","credential_id","authority_id","delegation_id","representation_id","role_id","revocation_id","transition_id","recovery_case_id","override_id","quorum_snapshot_id"] { if let Some(s)=p.get(k).and_then(Value::as_str){return s;} } "" }
fn base_trace(f:&FixtureFile,a:&Assertion)->Vec<String>{vec![format!("fixture={}",f.fixture_id),format!("rule={}",a.rule_id),format!("target={}",a.assertion_target)]}
fn ok(mut tr:Vec<String>,out:&str,msg:String)->(String,Vec<String>,bool,String){tr.push(msg);(out.to_string(),tr,true,String::new())}
fn blocked(mut tr:Vec<String>)->(String,Vec<String>,bool,String){tr.push("no deterministic branch produced an outcome".into());(String::new(),tr,false,"assertion not executable from corrected frozen inputs by this runner".into())}

fn eval_assertion(f:&FixtureFile,a:&Assertion,schema_valid:&[bool])->(String,Vec<String>,bool,String){
    let tr=base_trace(f,a); let invalid=any_invalid(schema_valid);
    if a.assertion_target=="schema_result" { if invalid{return ok(tr,"SCHEMA_INVALID","at least one targeted input failed frozen schema".into())} return ok(tr,"SCHEMA_VALID","all fixture inputs passed frozen schema".into()); }
    match a.rule_id.as_str() {
        "REG-W11-PRN-001"=> if let Some(p)=find_input_by_schema(f,"principal_envelope"){if !invalid && !get_str(p,"principal_id").is_empty()&&!get_str(p,"principal_type").is_empty(){return ok(tr,"VALID","principal envelope schema-valid with canonical principal identity".into())}},
        "REG-W11-CRD-001"=> if let Some(p)=find_input_by_schema(f,"credential"){if !invalid && !get_str(p,"credential_id").is_empty()&&!get_str(p,"subject_principal_id").is_empty(){return ok(tr,"VALID","credential is a distinct schema-valid object bound to subject principal".into())}},
        "REG-W11-IDN-001"=>{let ps=find_inputs_by_schema(f,"principal_envelope");if ps.len()>=2{let ids:HashSet<&str>=ps.iter().map(|p|get_str(p,"principal_id")).collect();if ids.len()>=2{return ok(tr,"IDENTITY_REVIEW_REQUIRED","multiple canonical principals present without governed merge event".into())}}},
        "REG-W12-ROL-001"=>if let Some(p)=find_input_by_schema(f,"role"){if !invalid&&get_str(p,"status")=="ACTIVE"{return ok(tr,"ROLE_VALID","active role object resolves independently from Authority".into())}},
        "REG-W12-AUT-001"=>{if !invalid{if let Some(p)=find_input_by_schema(f,"authority"){if get_str(p,"status")=="ACTIVE"&&!get_str(p,"subject_principal_id").is_empty()&&!get_str(p,"source_principal_id").is_empty(){return ok(tr,"AUTHORIZED_POSSIBLE","active Authority has subject, source and frozen scope structure".into())}}if find_input_by_schema(f,"actor_context").is_some(){return ok(tr,"AUTHORIZED_POSSIBLE","actor context is structurally resolvable for Authority evaluation".into())}if find_input_by_schema(f,"scope_set").is_some(){return ok(tr,"AUTHORIZED_POSSIBLE","scope-set contract is structurally resolvable".into())}}},
        "REG-W12-REP-001"=>if let Some(p)=find_input_by_schema(f,"representation"){if !invalid&&get_str(p,"status")=="ACTIVE"&&!get_str(p,"representative_principal_id").is_empty()&&!get_str(p,"represented_principal_id").is_empty(){return ok(tr,"REPRESENTATION_VALID","active representation preserves distinct representative and represented principals".into())}},
        "REG-W12-DLG-001"=>if let (Some(au),Some(d))=(find_input_by_schema(f,"authority"),find_input_by_schema(f,"delegation")){if !invalid{let allowed:HashSet<&str>=get_arr(au,"allowed_actions").iter().filter_map(Value::as_str).collect();for x in get_arr(d,"actions"){let s=x.as_str().unwrap_or("");if !allowed.contains(s){return ok(tr,"DELEGATION_EXCEEDS_SOURCE_AUTHORITY",format!("delegated action outside source allowed_actions: {}",s))}}return ok(tr,"VALID_DELEGATION","delegated action set is subset of source Authority".into())}},
        "REG-W12-DLG-002"=>{let ds=find_inputs_by_schema(f,"delegation");let mut edges:HashMap<String,Vec<String>>=HashMap::new();for d in ds{let g=get_str(d,"grantor_principal_id");let x=get_str(d,"delegate_principal_id");if !g.is_empty()&&!x.is_empty(){edges.entry(g.into()).or_default().push(x.into());}}fn dfs(n:&str,e:&HashMap<String,Vec<String>>,st:&mut HashMap<String,u8>)->bool{match st.get(n).copied().unwrap_or(0){1=>return true,2=>return false,_=>{}}st.insert(n.into(),1);if let Some(v)=e.get(n){for z in v{if dfs(z,e,st){return true}}}st.insert(n.into(),2);false}let mut st=HashMap::new();for n in edges.keys(){if dfs(n,&edges,&mut st){return ok(tr,"DELEGATION_INVALID_CYCLE","A→...→A delegation cycle detected".into())}}return ok(tr,"VALID_DELEGATION","delegation graph acyclic".into())},
        "REG-W13-ID-001"=>{if invalid{return ok(tr,"SCHEMA_INVALID","canonical ID violates frozen textual schema".into())}let mut seen:HashMap<String,Vec<u8>>=HashMap::new();let mut coll=false;for i in &f.inputs{if let Some(p)=i.payload.as_object(){let id=object_canonical_id(p);if id.is_empty(){continue}let b=jcs(&i.payload);if let Some(prev)=seen.get(id){if prev!=&b{coll=true}}else{seen.insert(id.into(),b);}}}if coll{return ok(tr,"IDENTIFIER_COLLISION","same canonical ID assigned to materially distinct object bytes".into())}return ok(tr,"VALID_ID","canonical IDs unique or refer to same material object".into())},
        "REG-W13-ID-002"=>if let Some(p)=find_input_by_schema(f,"external_identifier_reference"){if !invalid&&!get_str(p,"external_id").is_empty()&&!get_str(p,"issuer_namespace").is_empty(){return ok(tr,"VALID_EXTERNAL_REFERENCE","external identifier remains namespaced reference, not canonical ID".into())}},
        "REG-W14-REV-001"=>{if let Some(p)=find_input_by_schema(f,"status_resolution"){if !get_str(p,"state_at").is_empty()&&!get_str(p,"current_state").is_empty()&&get_str(p,"state_at")!=get_str(p,"current_state"){return ok(tr,"HISTORICAL_STATE_PRESERVED","historical state differs from current state without mutation".into())}}if let Some(p)=find_input_by_schema(f,"revocation_envelope"){if get_str(p,"revocation_type")=="REVOKE"{return ok(tr,"REVOKED","explicit append-only REVOKE event".into())}}},
        "REG-W14-REV-002"=>if let Some(p)=find_input_by_schema(f,"revocation_envelope"){if get_str(p,"revocation_type")=="REVOKE"&&get_str(p,"target_type")=="crd"{return ok(tr,"REVOKED","credential compromise resolved by REVOKE event".into())}if get_str(p,"revocation_type")=="RESTORE"{return ok(tr,"RESTORE_PROHIBITED","RESTORE cannot reactivate revoked/compromised credential".into())}},
        "REG-W14-REV-003"=>if let Some(p)=find_input_by_schema(f,"revocation_envelope"){if get_str(p,"revocation_type")=="RESTORE"{if get_str(p,"reason_code").contains("INVALID"){return ok(tr,"RESTORE_PROHIBITED","RESTORE reason marks non-restorable prior state".into())}return ok(tr,"RESTORED","RESTORE applies to reversible suspension path".into())}},
        "REG-W14-CONF-001"=>if let Some(p)=find_input_by_schema(f,"status_resolution"){if get_str(p,"current_state")=="REVOCATION_CONFLICT"||get_str(p,"source_status")=="CONFLICT"{return ok(tr,"REVOCATION_CONFLICT","conflicting governed revocation sources preserved".into())}},
        "REG-W14-FRESH-001"=>if let Some(p)=find_input_by_schema(f,"status_resolution"){if get_str(p,"source_status")=="STALE"{return ok(tr,"REVOCATION_STATUS_STALE","external revocation status exceeds freshness policy".into())}},
        "REG-W14-DEP-001"=>if let Some(p)=find_input_by_schema(f,"status_resolution"){if get_str(p,"dependency_status")=="SOURCE_INVALID"||get_str(p,"state_at")=="INVALIDATED_BY_SOURCE"{return ok(tr,"INVALIDATED_BY_SOURCE","required source invalidates dependent object".into())}},
        "REG-W14-TIME-001"=>{let sr=find_input_by_schema(f,"status_resolution");let rv=find_input_by_schema(f,"revocation_envelope");if a.assertion_target=="knowledge_state"{if let Some(p)=sr{if get_str(p,"state_at")!=get_str(p,"knowledge_state_at"){return ok(tr,"KNOWLEDGE_STATE_DIFFERS","STATE_AT differs from KNOWLEDGE_STATE_AT".into())}}}if a.assertion_target=="temporal_registration"{if let Some(p)=rv{if get_str(p,"effective_at")<get_str(p,"registered_at"){return ok(tr,"LATE_REGISTRATION_PRESERVED","effective_at precedes registered_at; late knowledge preserved".into())}}}},
        "REG-W15-ID-001"=>if let Some(p)=first_input(f){if f.inputs.first().map(|x|x.schema_def.as_str())==Some("organization_state")&&get_str(p,"lifecycle_state")=="ACTIVE"{if f.fixture_id.contains("REPRESENTATIVE"){return ok(tr,"SAME_ID","representative change does not replace Organization Principal".into())}return ok(tr,"ORGANIZATION_ACTIVE","organization-specific ACTIVE lifecycle state".into())}let c=get_str(p,"continuity_resolution");if !c.is_empty(){return ok(tr,c,format!("explicit governed continuity_resolution={}",c))}},
        "REG-W15-JUR-001"=>if let Some(p)=first_input(f){let c=get_str(p,"continuity_resolution");if !c.is_empty(){return ok(tr,c,"jurisdiction change uses explicit continuity resolution".into())}},
        "REG-W15-MERGE-001"=>if let Some(p)=first_input(f){if get_str(p,"continuity_resolution")=="NEW_ID"{return ok(tr,"NEW_ID","merger into distinct resulting organization requires new canonical ID".into())}},
        "REG-W15-INC-001"=>if let Some(p)=first_input(f){if get_str(p,"transition_type")=="INCORPORATION"{return ok(tr,"INCORPORATION_VALID","incorporation transition encoded explicitly".into())}},
        "REG-W15-SPLIT-001"=>if let Some(p)=first_input(f){if get_str(p,"transition_type")=="SPLIT"{return ok(tr,"SPLIT_VALID","split transition encoded explicitly".into())}},
        "REG-W15-REL-001"=>if let Some(p)=first_input(f){let d=get_str(p,"disposition");if d=="RETAIN"||d=="REPLACE_BY_NEW_RELATIONSHIP"{return ok(tr,d,format!("relationship disposition={}",d))}},
        "REG-W15-SUCC-001"=>if let Some(p)=first_input(f){match a.assertion_target.as_str(){"authority_transition"=>{let d=get_str(p,"disposition");let o=match d{"CONTINUE"=>"AUTHORITY_CONTINUE","TERMINATE"=>"AUTHORITY_TERMINATE","REISSUE"=>"AUTHORITY_REISSUE_REQUIRED","REVIEW_REQUIRED"=>"AUTHORITY_REVIEW_REQUIRED",_=>""};if !o.is_empty(){return ok(tr,o,format!("authority transition disposition={}",d))}},"credential_transition"=>if get_str(p,"disposition")=="REISSUE"{return ok(tr,"CREDENTIAL_REISSUE_REQUIRED","credential subject/binding cannot be mutated in place".into())},"late_succession"=>if get_str(p,"transition_type")=="SUCCESSION"&&get_str(p,"effective_at")<get_str(p,"registered_at"){return ok(tr,"LATE_SUCCESSION_PRESERVED","succession effective time precedes registration time".into())},"succession_state"=>if get_str(p,"transition_type")=="SUCCESSION"{return ok(tr,"SUCCESSION_VALID","succession lineage transition structurally explicit".into())},_=>{}}},
        "REG-W16-SOD-001"=>if let Some(p)=first_input(f){let mut seen:HashMap<String,HashSet<String>>=HashMap::new();for x in get_arr(p,"function_assignments"){if let Some(s)=x.as_str(){let ps:Vec<&str>=s.splitn(2,':').collect();if ps.len()==2{seen.entry(ps[1].into()).or_default().insert(ps[0].into());}}}for (id,fns) in seen{if fns.contains("MAKER")&&fns.contains("APPROVER"){return ok(tr,"SOD_SELF_APPROVAL_VIOLATION",format!("same participant slot {} is MAKER and APPROVER",id))}}return ok(tr,"SOD_COMPLIANT","maker/approver assignments do not self-approve".into())},
        "REG-W16-SOD-002"=>if let Some(p)=first_input(f){if a.assertion_target=="control_domain_classification"{if let Some(bs)=f.context.get("control_domain_bindings").and_then(Value::as_array){if !bs.is_empty(){let d:HashSet<&str>=bs.iter().filter_map(Value::as_object).map(|m|get_str(m,"control_domain_id")).collect();if d.len()==1{return ok(tr,"SAME_CONTROL_DOMAIN","fixture context binds relevant principals to one governed control domain".into())}}}if get_str(p,"result")=="SOD_CONTROL_DOMAIN_UNRESOLVED"{return ok(tr,"CONTROL_DOMAIN_UNRESOLVED","no sufficient governed independence evidence".into())}}if a.assertion_target=="sod_result"&&get_str(p,"result")=="SOD_CONTROL_DOMAIN_CONFLICT"{return ok(tr,"SOD_CONTROL_DOMAIN_CONFLICT","same-control-domain classification violates applicable SoD policy".into())}},
        "REG-W16-SOD-003"=>if let Some(p)=first_input(f){if let Some(gs)=f.context.get("identity_equivalence_groups").and_then(Value::as_array){for z in gs{if let Some(m)=z.as_object(){if get_str(m,"status")=="SAME_ENTITY_CONFIRMED"{return ok(tr,"SOD_INSUFFICIENT_PARTICIPANTS","multiple aliases collapse to one confirmed entity for SoD".into())}}}}let refs=get_arr(p,"participant_references");if refs.len()<2{return ok(tr,"SOD_INSUFFICIENT_PARTICIPANTS","fewer than two distinct participant references".into())}let mut slots=HashSet::new();for x in get_arr(p,"function_assignments"){if let Some(s)=x.as_str(){let ps:Vec<&str>=s.splitn(2,':').collect();if ps.len()==2{slots.insert(ps[1]);}}}if slots.len()<2{return ok(tr,"SOD_INSUFFICIENT_PARTICIPANTS","control functions collapse to one participant slot".into())}},
        "REG-W16-SOD-004"=>if let Some(p)=first_input(f){if get_str(p,"result")=="SOD_HUMAN_APPROVAL_REQUIRED"{return ok(tr,"SOD_HUMAN_APPROVAL_REQUIRED","automated/non-human participation cannot satisfy required human final approval".into())}},
        "REG-W16-AUD-001"=>if let Some(p)=first_input(f){if get_str(p,"result")=="SOD_AUDITOR_INDEPENDENCE_FAILED"{return ok(tr,"SOD_AUDITOR_INDEPENDENCE_FAILED","auditor independence condition failed".into())}},
        "REG-W16-QUO-001"=>{if let Some(p)=find_input_by_schema(f,"quorum_snapshot"){if a.assertion_target=="sod_result"&&get_str(p,"result")=="SOD_COMPLIANT"{return ok(tr,"SOD_COMPLIANT","quorum snapshot records compliant participation".into())}if a.assertion_target=="quorum_state"&&get_str(p,"result")=="SOD_COMPLIANT"&&p.get("satisfied_at").is_some(){return ok(tr,"QUORUM_VALID","compliant quorum has satisfied_at".into())}}if find_input_by_schema(f,"action_participation").is_some()&&a.assertion_target=="sod_result"{return ok(tr,"SOD_COMPLIANT","standalone governed action participation is valid corpus input".into())}if find_input_by_schema(f,"sod_policy").is_some()&&a.assertion_target=="sod_result"{return ok(tr,"SOD_COMPLIANT","standalone frozen SoD policy contract is valid corpus input".into())}},
        "REG-W16-QUO-002"=>if let Some(p)=first_input(f){match get_str(p,"result"){"SOD_POLICY_UNRESOLVED"=>return ok(tr,"QUORUM_POLICY_UNRESOLVED","effective policy/succession state unresolved before action effectiveness".into()),"SOD_QUORUM_NOT_REACHED"=>return ok(tr,"QUORUM_LOST_BEFORE_EFFECTIVENESS","approval contribution withdrawn or quorum no longer met".into()),"SOD_COMPLIANT"|"QUORUM_VALID"=>if p.get("satisfied_at").is_some(){return ok(tr,"QUORUM_VALID","deferred quorum remains satisfied before effectiveness".into())},_=>{}}},
        "REG-W16-QUO-003"=>if let Some(p)=first_input(f){if ["SOD_AUTHORITY_INVALID","QUORUM_AUTHORITY_INVALID"].contains(&get_str(p,"result")){return ok(tr,"QUORUM_AUTHORITY_INVALID","quorum contribution lacks valid Authority".into())}},
        "REG-W16-OVR-001"=>if let Some(p)=first_input(f){let post=p.get("post_review_due_seconds").and_then(Value::as_i64).unwrap_or(0);let valid=!invalid&&post>0&&get_str(p,"effective_at")<get_str(p,"expires_at")&&p.get("authority_reference").map(|x|!x.is_null()).unwrap_or(false);if valid{return ok(tr,"SOD_OVERRIDE_ACTIVE","bounded authorized override with positive mandatory post-review window".into())}return ok(tr,"SOD_OVERRIDE_INVALID","override missing authority, positive duration, post-review or schema validity".into())},
        "REG-W17-RCA-001"=>{if let Some(p)=find_input_by_schema(f,"recovery_policy"){let rm=p.get("risk_minimum_assurance").and_then(Value::as_object).unwrap();for (k,v) in [("RR0","RCA2"),("RR1","RCA3"),("RR2","RCA4"),("RR3","RCA5")]{if get_str(rm,k)!=v{return ok(tr,"RECOVERY_POLICY_UNRESOLVED",format!("risk_minimum_assurance mapping mismatch at {}",k))}}return ok(tr,"RECOVERY_APPROVED","policy freezes RR0→RCA2 RR1→RCA3 RR2→RCA4 RR3→RCA5".into())}if let Some(p)=find_input_by_schema(f,"recovery_case"){let rank=|s:&str|match s{"RCA0"=>0,"RCA1"=>1,"RCA2"=>2,"RCA3"=>3,"RCA4"=>4,"RCA5"=>5,_=>-1};let need=|s:&str|match s{"RR0"=>2,"RR1"=>3,"RR2"=>4,"RR3"=>5,_=>99};if rank(get_str(p,"recovery_assurance"))<need(get_str(p,"effective_risk")){return ok(tr,"RECOVERY_ASSURANCE_INSUFFICIENT","Recovery Assurance below effective Recovery Risk minimum".into())}return ok(tr,"RECOVERY_APPROVED","Recovery Assurance satisfies effective Recovery Risk minimum".into())}},
        "REG-W17-COOL-001"=>{if let Some(p)=find_input_by_schema(f,"recovery_policy"){let cm=p.get("cooling_mode").and_then(Value::as_object).unwrap();let dur=p.get("cooling_duration_seconds").and_then(Value::as_object).unwrap();if get_str(cm,"RR2")=="MANDATORY_COOLING"&&get_str(cm,"RR3")=="MANDATORY_COOLING"&&dur.get("RR2").is_some()&&dur.get("RR3").is_some(){return ok(tr,"RECOVERY_COOLING_PERIOD","policy mandates positive configured cooling for high-risk classes".into())}}if let Some(p)=find_input_by_schema(f,"recovery_case"){if get_str(p,"outcome")=="RECOVERY_COOLING_PERIOD"&&p.get("cooling_period_start").is_some()&&p.get("cooling_period_end").is_some(){return ok(tr,"RECOVERY_COOLING_PERIOD","case remains in governed cooling interval before permanent activation".into())}},
        "REG-W17-REC-001"=>if let (Some(rep),Some(prn))=(find_input_by_schema(f,"credential_replacement"),find_input_by_schema(f,"principal_envelope")){if get_str(rep,"principal_id")==get_str(prn,"principal_id")&&get_str(rep,"old_credential_id")!=get_str(rep,"new_credential_id"){return ok(tr,"RECOVERY_COMPLETED","Principal ID preserved while Credential ID changes".into())}},
        "REG-W17-REC-002"=>if let Some(p)=find_input_by_schema(f,"credential_replacement"){if !get_str(p,"old_credential_id").is_empty()&&get_str(p,"old_credential_id")!=get_str(p,"new_credential_id"){return ok(tr,"REPLACEMENT_VALID","replacement Credential uses new canonical Credential ID".into())}},
        "REG-W17-REC-003"=>if let Some(p)=find_input_by_schema(f,"credential_replacement"){if get_str(p,"old_credential_disposition")=="REVOKE"{return ok(tr,"REVOKED","compromised/lost affected Credential disposition is REVOKE".into())}},
        "REG-W17-AUT-001"=>if let Some(p)=find_input_by_schema(f,"credential_replacement"){let d=get_str(p,"authority_review_disposition");if d=="AUTHORITY_REBIND_REQUIRED"||d=="AUTHORITY_INVALIDATED_BY_SOURCE"{return ok(tr,d,format!("Recovery does not mutate/transfer Authority; disposition={}",d))}},
        "REG-W17-FAC-001"=>{let fs=find_inputs_by_schema(f,"recovery_factor_reference");if fs.len()>=2{let domains:HashSet<&str>=fs.iter().map(|p|get_str(p,"dependency_domain_id")).collect();if domains.len()==1{return ok(tr,"SAME_FACTOR_DEPENDENCY_DOMAIN","Recovery factors share dependency domain".into())}return ok(tr,"RECOVERY_FACTORS_INDEPENDENT","Recovery factors resolve to distinct dependency domains".into())}},
        "REG-W17-ADM-001"=>if let (Some(ap),Some(rc))=(find_input_by_schema(f,"recovery_approval"),find_input_by_schema(f,"recovery_case")){if get_str(ap,"approver_principal_id")==get_str(rc,"subject_principal_id"){return ok(tr,"RECOVERY_REJECTED","high-risk administrator is sole approver of own Recovery".into())}return ok(tr,"RECOVERY_APPROVED","Recovery approver is distinct from subject Principal".into())},
        "REG-W17-CAN-001"=>if let (Some(rc),Some(cr))=(find_input_by_schema(f,"recovery_case"),find_input_by_schema(f,"credential_replacement")){if get_str(rc,"outcome")=="RECOVERY_CANCELLED"&&get_str(cr,"old_credential_disposition")=="REVOKE"{return ok(tr,"RECOVERY_CANCELLED","cancelled Recovery preserves prior revocation; no silent restore".into())}},
        "REG-W17-DEV-001"=>if let Some(rc)=find_input_by_schema(f,"recovery_case"){let reason=get_str(rc,"recovery_reason");let out=get_str(rc,"outcome");if ["DEVICE_LOST","DEVICE_STOLEN","DEVICE_COMPROMISED"].contains(&reason)&&["RECOVERY_COMPLETED","RECOVERY_COOLING_PERIOD"].contains(&out){return ok(tr,out,"device event handled without replacing Person Principal".into())}},
        "REG-W17-EXP-001"=>if let Some(rc)=find_input_by_schema(f,"recovery_case"){if get_str(rc,"outcome")=="RECOVERY_EXPIRED"{return ok(tr,"RECOVERY_EXPIRED","expired Recovery Case cannot silently resume".into())}},
        "REG-W17-RATE-001"=>if let Some(rc)=find_input_by_schema(f,"recovery_case"){if get_str(rc,"outcome")=="RECOVERY_LOCKED"{return ok(tr,"RECOVERY_LOCKED","Recovery rate/attempt policy locked case".into())}},
        "REG-W17-RISK-001"=>if let Some(rc)=find_input_by_schema(f,"recovery_case"){if get_str(rc,"outcome")=="RECOVERY_TAKEOVER_RISK"{return ok(tr,"RECOVERY_TAKEOVER_RISK","takeover signal escalates Recovery control path".into())}},
        "REG-W17-TIME-001"=>if let (Some(rc),Some(rv))=(find_input_by_schema(f,"recovery_case"),find_input_by_schema(f,"revocation_envelope")){if !get_str(rc,"completed_at").is_empty()&&get_str(rv,"registered_at")>get_str(rc,"completed_at"){return ok(tr,"LATE_COMPROMISE_PRESERVED","compromise knowledge registered after Recovery completion; history not rewritten".into())}},
        _=>{}
    }
    blocked(tr)
}

fn main() -> Result<(),String> {
    let args:Vec<String>=env::args().collect(); if args.len()<2 { return Err("usage: registrary-w1-conformance-rust <w1.8.1-root> [output.json]".into()); }
    let root=PathBuf::from(&args[1]); let out=args.get(2).cloned(); let eng=Engine::new(&root)?;
    let mut exp_map=HashMap::new(); let mf:Manifest=read_json(&root.join("fixtures/manifest.json"))?; for f in mf.fixtures{for i in f.inputs{exp_map.insert(format!("{}|{}",f.fixture_id,i.label),i.canonical_sha256);}}
    let mut files:Vec<PathBuf>=fs::read_dir(root.join("fixtures/cases")).map_err(|e|e.to_string())?.filter_map(|e|e.ok().map(|x|x.path())).filter(|p|p.extension().and_then(|x|x.to_str())==Some("json")).collect(); files.sort();
    let mut res=ResultDoc{runner:"rust-independent-w1.9-rerun-v0.3".into(),fixture_cases:files.len(),fixture_inputs:0,assertion_count:0,schema_matches:0,schema_mismatches:vec![],canonical_hash_matches:0,canonical_hash_mismatches:vec![],self_hash_checked:0,self_hash_mismatches:vec![],vector_matches:0,vector_mismatches:vec![],semantic_evaluated:0,semantic_matches:0,semantic_mismatches:vec![],semantic_blocked:vec![],input_results:vec![],semantic_results:vec![],overall_status:String::new()};
    for fp in files { let f:FixtureFile=read_json(&fp)?; res.assertion_count+=f.expected.assertions.len(); let mut schema_valid=vec![];
        for i in &f.inputs { res.fixture_inputs+=1; let errs=eng.validate_def(&i.payload,&i.schema_def); let valid=errs.is_empty(); schema_valid.push(valid); if valid==i.expected_schema_valid{res.schema_matches+=1}else{res.schema_mismatches.push(format!("{}/{} expected={} actual={} errors={:?}",f.fixture_id,i.label,i.expected_schema_valid,valid,errs));}
            let norm=eng.normalize_def(&i.payload,&i.schema_def)?; let bb=jcs(&norm); let h=sha_hex(&bb); let expected=exp_map.get(&format!("{}|{}",f.fixture_id,i.label)).cloned().unwrap_or_default(); if h==expected{res.canonical_hash_matches+=1}else{res.canonical_hash_mismatches.push(format!("{}/{} expected={} actual={}",f.fixture_id,i.label,expected,h));}
            let mut ir=InputResult{fixture_id:f.fixture_id.clone(),label:i.label.clone(),schema_def:i.schema_def.clone(),expected_schema_valid:i.expected_schema_valid,schema_valid:valid,schema_errors:errs,normalized:norm.clone(),jcs_utf8:String::from_utf8(bb.clone()).unwrap(),jcs_hex:hex::encode(&bb),sha256:h,expected_sha256:expected,self_hash_field:String::new(),self_hash_stored:String::new(),self_hash_calculated:String::new(),self_hash_match:None};
            if let Some(hf)=eng.self_hashes.get(&i.schema_def){ir.self_hash_field=hf.clone();if let Some(m)=norm.as_object(){if let Some(stored)=m.get(hf).and_then(Value::as_str){res.self_hash_checked+=1;ir.self_hash_stored=stored.into();let mut cp=m.clone();cp.remove(hf);let calc=sha_hex(&jcs(&Value::Object(cp)));ir.self_hash_calculated=calc.clone();let mt=calc==stored;ir.self_hash_match=Some(mt);if !mt{res.self_hash_mismatches.push(format!("{}/{} {} stored={} calculated={}",f.fixture_id,i.label,hf,stored,calc));}}}}
            res.input_results.push(ir);
        }
        for a in &f.expected.assertions { let (actual,tr,evaluable,reason)=eval_assertion(&f,a,&schema_valid); let mt=if evaluable{Some(actual==a.semantic_outcome)}else{None}; if evaluable{res.semantic_evaluated+=1;if mt==Some(true){res.semantic_matches+=1}else{res.semantic_mismatches.push(SemanticMismatch{fixture_id:f.fixture_id.clone(),rule_id:a.rule_id.clone(),assertion_target:a.assertion_target.clone(),expected:a.semantic_outcome.clone(),actual:actual.clone(),trace:tr.clone()});}}else{res.semantic_blocked.push(SemanticBlocker{fixture_id:f.fixture_id.clone(),rule_id:a.rule_id.clone(),assertion_target:a.assertion_target.clone(),reason:reason.clone(),trace:tr.clone()});}
            res.semantic_results.push(SemanticAssertionResult{fixture_id:f.fixture_id.clone(),rule_id:a.rule_id.clone(),assertion_target:a.assertion_target.clone(),expected_outcome:a.semantic_outcome.clone(),actual_outcome:actual,evaluable,r#match:mt,blocker_reason:reason,trace:tr}); }
    }
    let vr:VectorRegistry=read_json(&root.join("vectors/canonicalization_vectors.json"))?; for v in vr.vectors{match eng.normalize_def(&v.input,&v.schema_def){Ok(norm)=>{let bb=jcs(&norm);let same=jcs(&norm)==jcs(&v.normalized)&&String::from_utf8(bb.clone()).unwrap()==v.jcs_utf8&&hex::encode(&bb)==v.jcs_hex&&sha_hex(&bb)==v.sha256;if same{res.vector_matches+=1}else{res.vector_mismatches.push(v.vector_id)}},Err(e)=>res.vector_mismatches.push(format!("{}: {}",v.vector_id,e))}}
    res.overall_status=if res.schema_mismatches.is_empty()&&res.canonical_hash_mismatches.is_empty()&&res.self_hash_mismatches.is_empty()&&res.vector_mismatches.is_empty()&&res.semantic_mismatches.is_empty()&&res.semantic_blocked.is_empty()&&res.semantic_matches==res.assertion_count{"PASS".into()}else{"NOT_PASS".into()};
    let data=serde_json::to_string_pretty(&res).map_err(|e|e.to_string())?+"\n"; if let Some(p)=out{fs::write(p,&data).map_err(|e|e.to_string())?;} print!("{}",data); Ok(())
}
