import json
from urllib import request, error

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.auth import require_admin, require_issuer_or_admin
from app.core.db import get_db
from app.models.organization import Organization

router = APIRouter()


class OrganizationCreate(BaseModel):
    name: str
    document: str | None = None


@router.post("")
def create_org(payload: OrganizationCreate, db: Session = Depends(get_db), _=Depends(require_admin)):
    org = Organization(name=payload.name, document=payload.document, status="active")
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

    return {
        "cnpj": payload.get("cnpj"),
        "razao_social": payload.get("razao_social"),
        "nome_fantasia": payload.get("nome_fantasia"),
        "descricao_situacao_cadastral": payload.get("descricao_situacao_cadastral"),
        "data_inicio_atividade": payload.get("data_inicio_atividade"),
        "municipio": payload.get("municipio"),
        "uf": payload.get("uf"),
        "cnae_fiscal_descricao": payload.get("cnae_fiscal_descricao"),
        "suggested_name": payload.get("nome_fantasia") or payload.get("razao_social"),
    }
