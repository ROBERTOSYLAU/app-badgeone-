"""
Integração com Cloudflare R2 (compatível com S3).
Estrutura de pastas no bucket:
  sign/[publicId].pdf           → PDFs assinados Badge One Sign
  certificates/[badgeId].pdf    → Certificados Badge One Certificate
  templates/[loteId].pdf        → Documentos modelo dos lotes
"""

import logging

logger = logging.getLogger(__name__)


def _get_settings():
    from app.core.config import settings
    return settings


def _get_client():
    import boto3
    from botocore.config import Config

    settings = _get_settings()
    return boto3.client(
        "s3",
        endpoint_url=settings.cloudflare_r2_endpoint,
        aws_access_key_id=settings.cloudflare_r2_access_key_id,
        aws_secret_access_key=settings.cloudflare_r2_secret_access_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def upload_file(content: bytes, key: str, content_type: str = "application/pdf") -> str:
    """
    Faz upload de bytes para o R2 e retorna a URL pública.
    Retorna URL vazia e loga erro se R2 não estiver configurado.
    """
    settings = _get_settings()

    if not settings.cloudflare_r2_endpoint or not settings.cloudflare_r2_access_key_id:
        logger.warning("R2 não configurado — pulando upload de arquivo: %s", key)
        return ""

    try:
        client = _get_client()
        client.put_object(
            Bucket=settings.cloudflare_r2_bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
        )
        url = f"{settings.cloudflare_r2_public_url}/{key}"
        logger.info("Arquivo enviado para R2: %s → %s", key, url)
        return url
    except Exception as exc:
        logger.exception("Erro ao fazer upload para R2 (%s): %s", key, exc)
        return ""


def delete_file(key: str) -> None:
    """Remove arquivo do R2. Ignora silenciosamente se R2 não estiver configurado."""
    settings = _get_settings()

    if not settings.cloudflare_r2_endpoint:
        return

    try:
        client = _get_client()
        client.delete_object(Bucket=settings.cloudflare_r2_bucket, Key=key)
        logger.info("Arquivo removido do R2: %s", key)
    except Exception as exc:
        logger.exception("Erro ao remover arquivo do R2 (%s): %s", key, exc)
