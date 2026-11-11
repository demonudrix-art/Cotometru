"""Securely stage already-trained football models; never deserialize downloaded pickle/joblib."""
import argparse,base64,hashlib,json
from pathlib import Path
HERE=Path(__file__).resolve().parent
def blob_sha(b):return hashlib.sha1(("blob "+str(len(b))+"\0").encode()+b).hexdigest()
def main():
 ap=argparse.ArgumentParser();ap.add_argument("--download-hf",action="store_true");ap.add_argument("--out",type=Path,default=HERE/"quarantine");args=ap.parse_args()
 manifest=json.loads((HERE/"manifest.json").read_text());out=args.out.resolve();out.mkdir(parents=True,exist_ok=True);results=[]
 for src in manifest["sources"]:
  if not src.get("bundled"):continue
  for f in src["files"]:
   rel=Path(f["path"]);inp=HERE/rel
   data=base64.b64decode("".join(inp.read_text().split()),validate=True) if rel.suffix==".b64" else inp.read_bytes()
   if blob_sha(data)!=f["git_blob_sha"]:raise RuntimeError("Origin blob mismatch: "+str(rel))
   dest=out/(rel.with_suffix("") if rel.suffix==".b64" else rel);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
   results.append({"path":str(dest.relative_to(out)),"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data),"state":"quarantined_not_loaded"})
 if args.download_hf:
  from huggingface_hub import model_info,hf_hub_download
  for src in manifest["sources"]:
   if src.get("platform")!="huggingface":continue
   revision=model_info(src["repository"]).sha
   for rel in src["remote_files"]:
    data=Path(hf_hub_download(repo_id=src["repository"],filename=rel,revision=revision)).read_bytes()
    dest=out/src["name"]/revision/rel;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(data)
    results.append({"path":str(dest.relative_to(out)),"sha256":hashlib.sha256(data).hexdigest(),"bytes":len(data),"state":"quarantined_not_loaded"})
 report={"artifacts":results,"production_enabled":False,"safe_to_unpickle":False,"warning":"No model inference until features, licenses, training period and independent Brier/ROI are validated."}
 (out/"import_status.json").write_text(json.dumps(report,indent=2,ensure_ascii=False)+"\n")
 print(json.dumps(report,indent=2,ensure_ascii=False))
if __name__=="__main__":main()
