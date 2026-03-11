import json
from urllib import request, error

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import require_admin, require_issuer_or_admin
from app.core.db import get_db
from app.models.organization import Organization
from app.models.lot import BadgeLot
from app.models.credential import Credential

router = APIRouter()


class OrganizationCreate(BaseModel):
    name: str | None = None
    document: str | None = None


def _lookup_cnpj_data(cnpj: str):
    only_digits = "".join(ch for ch in cnpj if ch.isdigit())
    if len(only_digits) != 14:
        raise HTTPException(status_code=400, detail="CNPJ inválido")

    url = f"https://brasilapi.com.br/api/cnpj/v1/{only_digits}"
    req = request.Request(url, headers={"User-Agent": "BadgeOne/1.0"})

    try:
        with request.urlopen(req, timeout=10) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
    except error.HTTPError as exc:
        if exc.code == 404:
            raise HTTPException(status_code=404, detail="CNPJ não encontrado")
        raise HTTPException(status_code=502, detail="Falha ao consultar CNPJ")
    except Exception:
        raise HTTPException(status_code=502, detail="Falha ao consultar CNPJ")

    return payload


@router.post("")
def create_org(payload: OrganizationCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    doc = (payload.document or "").strip() or None
    name = (payload.name or "").strip() or None

    if doc and not name:
        cnpj_data = _lookup_cnpj_data(doc)
        name = cnpj_data.get("razao_social") or cnpj_data.get("nome_fantasia")

    if not name:
        raise HTTPException(status_code=400, detail="Informe nome ou CNPJ válido")

    org = Organization(name=name, document=doc, status="active")
    db.add(org)
    db.commit()
    db.refresh(org)
    return {"id": org.id, "name": org.name, "document": org.document, "status": org.status}


@router.get("")
def list_orgs(db: Session = Depends(get_db), _=Depends(require_issuer_or_admin)):
    data = db.query(Organization).order_by(Organization.id.desc()).all()
    return [{"id": x.id, "name": x.name, "document": x.document, "status": x.status} for x in data]


@router.get("/cnpj/{cnpj}")
def lookup_cnpj(cnpj: str, _=Depends(require_admin)):
    payload = _lookup_cnpj_data(cnpj)
    return {
        "cnpj": payload.get("cnpj"),
        "razao_social": payload.get("razao_social"),
        "nome_fantasia": payload.get("nome_fantasia"),
        "descricao_situacao_cadastral": payload.get("descricao_situacao_cadastral"),
        "data_inicio_atividade": payload.get("data_inicio_atividade"),
        "municipio": payload.get("municipio"),
        "uf": payload.get("uf"),
        "logradouro": payload.get("logradouro"),
        "numero": payload.get("numero"),
        "bairro": payload.get("bairro"),
        "complemento": payload.get("complemento"),
        "cep": payload.get("cep"),
        "natureza_juridica": payload.get("natureza_juridica"),
        "cnae_fiscal_descricao": payload.get("cnae_fiscal_descricao"),
        "cnaes_secundarios": payload.get("cnaes_secundarios") or [],
        "suggested_name": payload.get("razao_social") or payload.get("nome_fantasia"),
    }


@router.post("/{org_id}/deactivate")
def deactivate_org(org_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    org.status = "inactive"
    db.commit()
    db.refresh(org)
    return {"ok": True, "mode": "deactivated", "id": org.id, "status": org.status}


@router.post("/{org_id}/activate")
def activate_org(org_id: int, db: Session = Depends(get_db), _=Depends(require_admin)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    org.status = "active"
    db.commit()
    db.refresh(org)
    return {"ok": True, "mode": "activated", "id": org.id, "status": org.status}


@router.delete("/{org_id}")
def delete_org(org_id: int, force: bool = Query(False), db: Session = Depends(get_db), _=Depends(require_admin)):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    has_lot = db.query(BadgeLot).filter(BadgeLot.organization_id == org_id).first() is not None
    has_cred = db.query(Credential).filter(Credential.organization_id == org_id).first() is not None

    if (has_lot or has_cred) and not force:
        raise HTTPException(status_code=409, detail="Organização possui vínculos. Use force=true para exclusão total.")

    if force:
        db.query(Credential).filter(Credential.organization_id == org_id).delete(synchronize_session=False)
        db.query(BadgeLot).filter(BadgeLot.organization_id == org_id).delete(synchronize_session=False)

    db.delete(org)
    db.commit()
    return {"ok": True, "mode": "deleted", "id": org_id}
