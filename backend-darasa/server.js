const express = require('express');
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware to parse JSON bodies
app.use(express.json());

// Root test route
app.get('/', (req, res) => {
  res.send('Darasa Strath backend is running.');
});

// API test route
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Darasa API!' });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
