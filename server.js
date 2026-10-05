const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const app = express();
const port = 3000;
const JWT_SECRET = 'supersecret_campus_key';

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

const db = new sqlite3.Database(path.join(__dirname, 'fixit.db'), (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('Connected to SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS issues (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            by_user TEXT,
            cat TEXT,
            desc TEXT,
            loc TEXT,
            prio TEXT,
            sugg TEXT,
            status TEXT,
            worker TEXT,
            dupOf INTEGER,
            link INTEGER,
            votes TEXT,
            times TEXT,
            remarks TEXT,
            before_photo TEXT,
            after_photo TEXT
        )`);
        db.run(`CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT,
            role TEXT
        )`, async () => {
            const adminPass = await bcrypt.hash('admin123', 10);
            db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('admin01', ?, 'admin')`, [adminPass]);
            const raviPass = await bcrypt.hash('ravi123', 10);
            db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('Ravi (Electrician)', ?, 'worker')`, [raviPass]);
            const meenaPass = await bcrypt.hash('meena123', 10);
            db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('Meena (Plumber)', ?, 'worker')`, [meenaPass]);
            const karthikPass = await bcrypt.hash('karthik123', 10);
            db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('Karthik (Carpenter)', ?, 'worker')`, [karthikPass]);
            const sureshPass = await bcrypt.hash('suresh123', 10);
            db.run(`INSERT OR IGNORE INTO users (username, password, role) VALUES ('Suresh (General)', ?, 'worker')`, [sureshPass]);
        });
    }
});

function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
}

app.post('/api/register', async (req, res) => {
    const { username, password, role } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (username, password, role) VALUES (?, ?, ?)`, [username, hashedPassword, role], function(err) {
            if (err) return res.status(400).json({ error: 'Username already exists' });
            res.json({ success: true });
        });
    } catch (e) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    db.get(`SELECT * FROM users WHERE username = ?`, [username], async (err, user) => {
        if (err) return res.status(500).json({ error: 'Server error' });
        if (!user) return res.status(400).json({ error: 'User not found' });
        if (await bcrypt.compare(password, user.password)) {
            const token = jwt.sign({ username: user.username, role: user.role }, JWT_SECRET);
            res.json({ token, role: user.role });
        } else {
            res.status(400).json({ error: 'Incorrect password' });
        }
    });
});

// Get all issues
app.get('/api/issues', authenticateToken, (req, res) => {
    db.all('SELECT * FROM issues ORDER BY id DESC', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        
        // Parse JSON fields
        const issues = rows.map(row => ({
            ...row,
            votes: JSON.parse(row.votes || '[]'),
            times: JSON.parse(row.times || '[]')
        }));
        
        res.json(issues);
    });
});

// Create issue
app.post('/api/issues', authenticateToken, (req, res) => {
    const { by_user, cat, desc, loc, prio, sugg, status, dupOf, before_photo } = req.body;
    const times = JSON.stringify([['Reported', Date.now()]]);
    const votes = JSON.stringify([]);
    
    db.run(`INSERT INTO issues (by_user, cat, desc, loc, prio, sugg, status, dupOf, votes, times, before_photo) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [by_user, cat, desc, loc, prio, sugg, status, dupOf, votes, times, before_photo],
        function(err) {
            if (err) {
                res.status(500).json({ error: err.message });
                return;
            }
            res.json({ id: this.lastID });
        }
    );
});

// Update issue
app.put('/api/issues/:id', authenticateToken, (req, res) => {
    const id = req.params.id;
    const fields = Object.keys(req.body);
    const values = Object.values(req.body);
    
    // Convert arrays back to string if present
    const processedValues = values.map(v => Array.isArray(v) ? JSON.stringify(v) : v);
    processedValues.push(id);
    
    const setClause = fields.map(f => `${f} = ?`).join(', ');
    
    db.run(`UPDATE issues SET ${setClause} WHERE id = ?`, processedValues, function(err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ success: true, changes: this.changes });
    });
});

app.listen(port, () => {
    console.log(`FixIt backend running at http://localhost:${port}`);
});
