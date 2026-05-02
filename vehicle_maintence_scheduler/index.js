const express = require('express');
const axios = require('axios');

const app = express();
app.use(express.json());

const API_KEY = process.env.API_KEY || 'my-secret-key';
app.use((req, res, next) => {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    return res.status(403).json({ message: 'Forbidden' });
  }
  next();
});

const DEPOT_API = 'http://20.207.122.201/evaluation-service/depots';
const VEHICLE_API = 'http://20.207.122.201/evaluation-service/vehicles';

function knapsack(tasks, capacity) {
  const n = tasks.length;
  const dp = Array.from({ length: n + 1 }, () => Array(capacity + 1).fill(0));

  for (let i = 1; i <= n; i++) {
    const { Duration, Impact } = tasks[i - 1];
    for (let w = 0; w <= capacity; w++) {
      if (Duration <= w) {
        dp[i][w] = Math.max(
          Impact + dp[i - 1][w - Duration],
          dp[i - 1][w]
        );
      } else {
        dp[i][w] = dp[i - 1][w];
      }
    }
  }

  let w = capacity;
  const selected = [];

  for (let i = n; i > 0; i--) {
    if (dp[i][w] !== dp[i - 1][w]) {
      selected.push(tasks[i - 1]);
      w -= tasks[i - 1].Duration;
    }
  }

  return selected.reverse();
}

app.get('/schedule/:depotId', async (req, res) => {
  try {
    const depotId = parseInt(req.params.depotId, 10);
    if (Number.isNaN(depotId)) {
      return res.status(400).json({ message: 'Depot ID must be a number' });
    }

    const [depotsRes, vehiclesRes] = await Promise.all([
      axios.get(DEPOT_API),
      axios.get(VEHICLE_API)
    ]);

    const depot = depotsRes.data.depots.find((d) => d.ID === depotId);
    if (!depot) {
      return res.status(404).json({ message: 'Depot not found' });
    }

    const capacity = depot.MechanicHours;
    const tasks = vehiclesRes.data.vehicles || [];
    const selectedTasks = knapsack(tasks, capacity);
    const totalImpact = selectedTasks.reduce((sum, task) => sum + task.Impact, 0);
    const totalDuration = selectedTasks.reduce((sum, task) => sum + task.Duration, 0);

    res.json({
      depotId,
      capacity,
      totalTasksSelected: selectedTasks.length,
      totalImpact,
      totalDuration,
      selectedTasks
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unexpected error' });
  }
});

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Stop the other process or set PORT to a free port.`);
    process.exit(1);
  }
  console.error('Server error:', error);
  process.exit(1);
});
