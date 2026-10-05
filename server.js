const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const app = express();
const port = 3000;

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
    }
});

// Get all issues
app.get('/api/issues', (req, res) => {
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
app.post('/api/issues', (req, res) => {
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
app.put('/api/issues/:id', (req, res) => {
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
