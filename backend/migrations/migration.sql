-- Migration: Add missing columns to organizations table
-- Execute this in PostgreSQL

-- Check current columns
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'organizations';

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add address column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'address') THEN
        ALTER TABLE organizations ADD COLUMN address TEXT;
        RAISE NOTICE 'Added column: address';
    END IF;

    -- Add cnae column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'cnae') THEN
        ALTER TABLE organizations ADD COLUMN cnae VARCHAR(255);
        RAISE NOTICE 'Added column: cnae';
    END IF;

    -- Add opening_date column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'opening_date') THEN
        ALTER TABLE organizations ADD COLUMN opening_date VARCHAR(20);
        RAISE NOTICE 'Added column: opening_date';
    END IF;

    -- Add regime column
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'organizations' AND column_name = 'regime') THEN
        ALTER TABLE organizations ADD COLUMN regime VARCHAR(100);
        RAISE NOTICE 'Added column: regime';
    END IF;
END $$;

-- Verify columns were added
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'organizations';
