const Database = require('better-sqlite3');
const path = require('path');
const crypto = require('crypto');

// Path to the database
// Assuming this script is in tools/ and database is in data/
const dbPath = path.join(__dirname, '../data/database.db');

console.log(`Connecting to database at ${dbPath}`);
const db = new Database(dbPath, { verbose: console.log });

// 1. Add columns to 'users' table
const addColumn = (columnName, columnDef) => {
    try {
        db.prepare(`ALTER TABLE users ADD COLUMN ${columnName} ${columnDef}`).run();
        console.log(`Added column '${columnName}' to 'users' table.`);
    } catch (err) {
        if (err.message.includes('duplicate column name')) {
            console.log(`Column '${columnName}' already exists.`);
        } else {
            console.error(`Error adding column ${columnName}:`, err.message);
            throw err;
        }
    }
};

try {
    db.transaction(() => {
        // SQLite limitation: Cannot add a UNIQUE column directly via ALTER TABLE
        // Workaround: Add column as TEXT, then create UNIQUE INDEX
        addColumn('email', 'TEXT');
        
        addColumn('password_hash', 'TEXT');
        addColumn('is_admin', 'INTEGER DEFAULT 0'); // SQLite uses INTEGER for boolean (0/1)
    })();

    try {
        db.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)').run();
        console.log("Created unique index on 'email'.");
    } catch (err) {
        console.error("Error creating unique index on email:", err.message);
    }
} catch (error) {
    console.error("Transaction failed:", error);
}

// 2. Insert default MAIN ADMIN user
const mainAdminPseudo = 'MAIN_ADMIN';
const mainAdminEmail = 'admin@admin.com';
const defaultPassword = 'terranumerica2025';
// Simple SHA256 hash for now (in production use bcrypt/argon2)
const passwordHash = crypto.createHash('sha256').update(defaultPassword).digest('hex');

try {
    const stmt = db.prepare(`
        INSERT INTO users (pseudo, email, password_hash, is_admin)
        VALUES (?, ?, ?, 1)
        ON CONFLICT(pseudo) DO UPDATE SET
            is_admin = 1,
            email = COALESCE(users.email, excluded.email),
            password_hash = COALESCE(users.password_hash, excluded.password_hash)
    `);
    stmt.run(mainAdminPseudo, mainAdminEmail, passwordHash);
    console.log(`MAIN ADMIN user ensured: ${mainAdminPseudo}`);
} catch (err) {
    console.error('Error inserting MAIN ADMIN:', err);
}

// 3. Prevent deletion/demotion of MAIN ADMIN (Trigger)
try {
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS prevent_admin_deletion
        BEFORE DELETE ON users
        FOR EACH ROW
        WHEN OLD.pseudo = '${mainAdminPseudo}'
        BEGIN
            SELECT RAISE(ABORT, 'Cannot delete the MAIN ADMIN account.');
        END;
    `);
    console.log('Trigger prevent_admin_deletion created.');

    db.exec(`
        CREATE TRIGGER IF NOT EXISTS prevent_admin_demotion
        BEFORE UPDATE OF is_admin ON users
        FOR EACH ROW
        WHEN OLD.pseudo = '${mainAdminPseudo}' AND NEW.is_admin != 1
        BEGIN
            SELECT RAISE(ABORT, 'Cannot remove admin status from MAIN ADMIN account.');
        END;
    `);
    console.log('Trigger prevent_admin_demotion created.');
    
    // Also prevent changing pseudo of MAIN ADMIN
     db.exec(`
        CREATE TRIGGER IF NOT EXISTS prevent_admin_rename
        BEFORE UPDATE OF pseudo ON users
        FOR EACH ROW
        WHEN OLD.pseudo = '${mainAdminPseudo}' AND NEW.pseudo != '${mainAdminPseudo}'
        BEGIN
            SELECT RAISE(ABORT, 'Cannot rename the MAIN ADMIN account.');
        END;
    `);
    console.log('Trigger prevent_admin_rename created.');

} catch (err) {
    console.error('Error creating triggers:', err);
}

db.close();
console.log('Migration completed.');
