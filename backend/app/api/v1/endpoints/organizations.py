import json
from urllib import request, error

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.core.auth import require_admin, require_issuer_or_admin
from app.models.user import User
from app.core.db import get_db
from app.models.organization import Organization
from app.models.lot import BadgeLot
from app.models.credential import Credential
from app.models.organization_note import OrganizationNote
from app.core.security import hash_password

router = APIRouter()


class OrganizationCreate(BaseModel):
    name: str | None = None
    document: str | None = None
    address: str | None = None
    cnae: str | None = None
    opening_date: str | None = None
    regime: str | None = None


def _clean_text(value):
    return (value or "").strip()


def _build_logradouro(payload: dict) -> str:
    raw = _clean_text(payload.get("logradouro"))
    if not raw:
        return ""

    prefix_candidates = [
        payload.get("descricao_tipo_de_logradouro"),
        payload.get("descricao_tipo_logradouro"),
        payload.get("tipo_logradouro"),
        payload.get("logradouro_tipo"),
    ]

    prefix = ""
    for item in prefix_candidates:
        text_value = _clean_text(item)
        if text_value:
            prefix = text_value
            break

    upper_raw = raw.upper()
    known_prefixes = (
        "R ", "RUA ",
        "AV ", "AV. ", "AVENIDA ",
        "AL ", "AL. ", "ALAMEDA ",
        "TR ", "TRAVESSA ",
        "TV ", "TV. ",
        "ROD ", "ROD. ", "RODOVIA ",
        "EST ", "EST. ", "ESTRADA ",
        "PC ", "PC. ", "PRAÇA ", "PRACA ",
        "VL ", "VILA ",
        "LOT ", "LOTEAMENTO ",
    )

    if upper_raw.startswith(known_prefixes):
        return raw

    if prefix:
        prefix_upper = prefix.upper().strip().rstrip(".")
        prefix_map = {
            "RUA": "R",
            "R": "R",
            "AVENIDA": "AV",
            "AV": "AV",
            "ALAMEDA": "AL",
            "AL": "AL",
            "TRAVESSA": "TR",
            "TR": "TR",
            "TV": "TV",
            "RODOVIA": "ROD",
            "ROD": "ROD",
            "ESTRADA": "EST",
            "EST": "EST",
            "PRAÇA": "PC",
            "PRACA": "PC",
            "PC": "PC",
            "VILA": "VL",
            "VL": "VL",
            "LOTEAMENTO": "LOT",
            "LOT": "LOT",
        }
        short_prefix = prefix_map.get(prefix_upper, prefix_upper)
        return f"{short_prefix} {raw}".strip()

    return raw


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
def create_org(
    payload: OrganizationCreate,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    try:
        doc = (payload.document or "").strip() or None
        name = (payload.name or "").strip() or None

        if doc and not name:
            cnpj_data = _lookup_cnpj_data(doc)
            name = cnpj_data.get("razao_social") or cnpj_data.get("nome_fantasia")

        if not name:
            raise HTTPException(status_code=400, detail="Informe nome ou CNPJ válido")

        org = Organization(
            name=name,
            document=doc,
            status="active",
            address=payload.address,
            cnae=payload.cnae,
            opening_date=payload.opening_date,
            regime=payload.regime,
        )

        db.add(org)
        db.commit()
        db.refresh(org)

        # Auto-create default issuer user for this org
        issuer_email = f"emissor{org.id}@badgeone.com.br"
        if not db.query(User).filter(User.email == issuer_email).first():
            issuer = User(
                email=issuer_email,
                name=f"Emissor {org.name}",
                password_hash=hash_password("Emissor123"),
                role="issuer",
                status="active",
                organization_id=org.id,
            )
            db.add(issuer)
            db.commit()

        return {
            "id": org.id,
            "name": org.name,
            "document": org.document,
            "status": org.status,
            "address": org.address,
            "cnae": org.cnae,
            "opening_date": org.opening_date,
            "regime": org.regime,
            "issuer_email": issuer_email,
            "issuer_password_default": "Emissor123",
        }

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Erro interno ao criar organização: {str(e)}")


@router.get("")
def list_orgs(
    db: Session = Depends(get_db),
    user: User = Depends(require_issuer_or_admin),
):
    q = db.query(Organization)

    if user.role == "issuer":
        if user.organization_id is None:
            return []
        q = q.filter(Organization.id == user.organization_id)

    data = q.order_by(Organization.id.desc()).all()

    return [
        {
            "id": x.id,
            "name": x.name,
            "document": x.document,
            "status": x.status,
            "address": x.address,
            "cnae": x.cnae,
            "opening_date": x.opening_date,
            "regime": x.regime,
            "created_at": x.created_at.isoformat() if x.created_at else None,
        }
        for x in data
    ]


@router.get("/cnpj/{cnpj}")
def lookup_cnpj(cnpj: str, _=Depends(require_admin)):
    payload = _lookup_cnpj_data(cnpj)
    logradouro_completo = _build_logradouro(payload)

    return {
        "cnpj": payload.get("cnpj"),
        "razao_social": payload.get("razao_social"),
        "nome_fantasia": payload.get("nome_fantasia"),
        "descricao_situacao_cadastral": payload.get("descricao_situacao_cadastral"),
        "data_inicio_atividade": payload.get("data_inicio_atividade"),
        "municipio": payload.get("municipio"),
        "uf": payload.get("uf"),
        "logradouro": logradouro_completo,
        "logradouro_sem_prefixo": payload.get("logradouro"),
        "descricao_tipo_de_logradouro": payload.get("descricao_tipo_de_logradouro"),
        "descricao_tipo_logradouro": payload.get("descricao_tipo_logradouro"),
        "tipo_logradouro": payload.get("tipo_logradouro"),
        "logradouro_tipo": payload.get("logradouro_tipo"),
        "numero": payload.get("numero"),
        "bairro": payload.get("bairro"),
        "complemento": payload.get("complemento"),
        "cep": payload.get("cep"),
        "natureza_juridica": payload.get("natureza_juridica"),
        "cnae_fiscal": payload.get("cnae_fiscal"),
        "cnae_fiscal_descricao": payload.get("cnae_fiscal_descricao"),
        "cnaes_secundarios": payload.get("cnaes_secundarios") or [],
        "suggested_name": payload.get("razao_social") or payload.get("nome_fantasia"),
    }


@router.post("/{org_id}/deactivate")
def deactivate_org(
    org_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    org.status = "inactive"
    db.commit()
    db.refresh(org)

    return {"ok": True, "mode": "deactivated", "id": org.id, "status": org.status}


@router.post("/{org_id}/activate")
def activate_org(
    org_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    org.status = "active"
    db.commit()
    db.refresh(org)

    return {"ok": True, "mode": "activated", "id": org.id, "status": org.status}


@router.delete("/{org_id}")
def delete_org(
    org_id: int,
    force: bool = Query(False),
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    if not force:
        org.status = "trashed"
        db.commit()
        db.refresh(org)
        return {"ok": True, "mode": "trashed", "id": org.id, "status": org.status}

    try:
        user_table = getattr(User, "__tablename__", "users")
        db.execute(
            text(f"UPDATE {user_table} SET organization_id = NULL WHERE organization_id = :org_id"),
            {"org_id": org_id},
        )

        db.query(OrganizationNote).filter(OrganizationNote.organization_id == org_id).delete(
            synchronize_session=False
        )
        db.query(Credential).filter(Credential.organization_id == org_id).delete(
            synchronize_session=False
        )
        db.query(BadgeLot).filter(BadgeLot.organization_id == org_id).delete(
            synchronize_session=False
        )

        db.delete(org)
        db.commit()

        return {"ok": True, "mode": "deleted", "id": org_id}

    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Erro ao excluir permanentemente organização: {str(e)}",
        )


@router.post("/{org_id}/restore")
def restore_org(
    org_id: int,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    org.status = "active"
    db.commit()
    db.refresh(org)

    return {"ok": True, "mode": "restored", "id": org.id, "status": org.status}


@router.patch("/{org_id}")
def update_org(
    org_id: int,
    data: dict,
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    org = db.query(Organization).filter(Organization.id == org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organização não encontrada")

    if "name" in data:
        org.name = data["name"]
    if "document" in data:
        org.document = data["document"]
    if "address" in data:
        org.address = data["address"]
    if "cnae" in data:
        org.cnae = data["cnae"]
    if "opening_date" in data:
        org.opening_date = data["opening_date"]
    if "regime" in data:
        org.regime = data["regime"]

    db.commit()
    db.refresh(org)

    return {
        "ok": True,
        "id": org.id,
        "name": org.name,
        "document": org.document,
        "address": org.address,
        "cnae": org.cnae,
        "opening_date": org.opening_date,
        "regime": org.regime,
    }


@router.post("/migrate/add-fields")
def migrate_add_fields(
    db: Session = Depends(get_db),
    _=Depends(require_admin),
):
    from sqlalchemy import text

    try:
        result = db.execute(
            text(
                """
                SELECT column_name
                FROM information_schema.columns
                WHERE table_name = 'organizations'
                """
            )
        )
        existing_columns = {row[0] for row in result}

        added = []

        columns_to_add = {
            "address": "TEXT",
            "cnae": "VARCHAR(255)",
            "opening_date": "VARCHAR(20)",
            "regime": "VARCHAR(100)",
        }

        for col_name, col_type in columns_to_add.items():
            if col_name not in existing_columns:
                db.execute(
                    text(
                        f"""
                        ALTER TABLE organizations
                        ADD COLUMN {col_name} {col_type}
                        """
                    )
                )
                added.append(col_name)

        db.commit()

        return {
            "ok": True,
            "message": "Migração concluída",
            "existing_columns": list(existing_columns),
            "added_columns": added,
        }

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Migration failed: {str(e)}")
