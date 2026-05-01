const express = require('express');
const router = express.Router();
const { getTodos, getStats, createTodo, updateTodo, deleteTodo } = require('../controllers/todoController');
const auth = require('../middleware/auth');

router.use(auth);

// GET /api/todos/stats  — must be before /:id
router.get('/stats', getStats);

// GET /api/todos          — with optional ?date=&category=&priority=
router.get('/', getTodos);

// POST /api/todos
router.post('/', createTodo);

// PUT /api/todos/:id
router.put('/:id', updateTodo);

// DELETE /api/todos/:id
router.delete('/:id', deleteTodo);

module.exports = router;
