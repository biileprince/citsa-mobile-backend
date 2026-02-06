// Vercel Serverless Function Entry Point
// This file is at /api/index.js and imports the compiled Express app
const app = require('../dist/app.js').default;

module.exports = app;
