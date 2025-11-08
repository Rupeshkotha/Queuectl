const express = require('express');
const path = require('path');
const db = require('./src/db');
const fs = require('fs');
const app = express();
const PORT = 8080;
const RUN_DIR = path.join(__dirname, '.queue_run');

app.use(express.static(path.join(__dirname, 'public')));
app.listen(PORT, () => {
    console.log(`Dashboard server running at http://localhost:${PORT}`);
});

app.get('/api/status', async (req, res) => {
 try {
  const counts = await db.getJobCounts();
   let workerCount = 0;
    if (fs.existsSync(RUN_DIR)) {
    workerCount = fs.readdirSync(RUN_DIR).filter(f => f.endsWith('.pid')).length;
   }
   counts.active_workers = workerCount; 
   res.json({ counts }); 
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});


app.get('/api/jobs', async (req, res) => {
  const { state } = req.query; 

  if (!state) {
    return res.status(400).json({ error: 'State query parameter is required' });
  }

  try {
    let jobs;
    if (state === 'dead') {
      jobs = await db.listDlqJobs();
    } else {
      jobs = await db.listJobs(state); 
    }
    res.json(jobs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

