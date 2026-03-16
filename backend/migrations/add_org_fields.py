#!/usr/bin/env python3
"""
Migration script to add new columns to organizations table
"""
import sys
sys.path.insert(0, '..')

from sqlalchemy import create_engine, text
from app.core.config import settings

def migrate():
    engine = create_engine(settings.DATABASE_URL)
    
    with engine.connect() as conn:
        # Check if columns exist
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'organizations'
        """))
        existing_columns = {row[0] for row in result}
        
        print(f"Colunas existentes: {existing_columns}")
        
        # Add missing columns
        columns_to_add = {
            'address': 'TEXT',
            'cnae': 'VARCHAR(255)',
            'opening_date': 'VARCHAR(20)',
            'regime': 'VARCHAR(100)'
        }
        
        for col_name, col_type in columns_to_add.items():
            if col_name not in existing_columns:
                print(f"Adicionando coluna: {col_name}")
                conn.execute(text(f"""
                    ALTER TABLE organizations 
                    ADD COLUMN {col_name} {col_type}
                """))
                conn.commit()
                print(f"✓ Coluna {col_name} adicionada com sucesso")
            else:
                print(f"✓ Coluna {col_name} já existe")
    
    print("\n✅ Migração concluída!")

if __name__ == "__main__":
    migrate()
