from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, future=True, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def run_migrations():
    """Run database migrations on startup"""
    with engine.connect() as conn:
        # Check if organizations table exists
        result = conn.execute(text("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'organizations'
            )
        """))
        table_exists = result.scalar()
        
        if not table_exists:
            return  # Table doesn't exist yet, will be created by Base.metadata.create_all()
        
        # Check existing columns
        result = conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'organizations'
        """))
        existing_columns = {row[0] for row in result}
        
        # Add missing columns
        columns_to_add = {
            'address': 'TEXT',
            'cnae': 'VARCHAR(255)',
            'opening_date': 'VARCHAR(20)',
            'regime': 'VARCHAR(100)'
        }
        
        for col_name, col_type in columns_to_add.items():
            if col_name not in existing_columns:
                conn.execute(text(f"""
                    ALTER TABLE organizations 
                    ADD COLUMN {col_name} {col_type}
                """))
                conn.commit()
                print(f"✅ Added column: {col_name}")
        
        conn.commit()
