import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

// Serve static files from public directory
app.use(express.static('public'));

// Mock Socket.IO for frontend testing
app.get('/socket.io/socket.io.js', (req, res) => {
    res.send(`
        // Mock Socket.IO for frontend testing
        window.io = function() {
            return {
                on: function(event, callback) {
                    console.log('Mock socket listening for:', event);
                    // Simulate connection
                    if (event === 'connect') {
                        setTimeout(() => callback(), 1000);
                    }
                },
                emit: function(event, data) {
                    console.log('Mock socket emitting:', event, data);
                }
            };
        };
    `);
});

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', message: 'Frontend test server running' });
});

app.listen(PORT, () => {
    console.log(`🚀 Frontend test server running on http://localhost:${PORT}`);
    console.log(`📱 Open your browser and navigate to http://localhost:${PORT}`);
    console.log(`🎨 Testing the beautiful new frontend design!`);
});
