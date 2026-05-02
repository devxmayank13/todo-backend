const express = require('express');
const router = express.Router();
const { getTodos, getStats, createTodo, updateTodo, deleteTodo, reorderTodos, breakdownTodo } = require('../controllers/todoController');
const auth = require('../middleware/auth');

router.use(auth);

// GET /api/todos/stats  — must be before /:id
router.get('/stats', getStats);

// GET /api/todos          — with optional ?date=&category=&priority=
router.get('/', getTodos);

// POST /api/todos
router.post('/', createTodo);

// PUT /api/todos/reorder
router.put('/reorder', reorderTodos);

// PUT /api/todos/:id
router.put('/:id', updateTodo);

// POST /api/todos/:id/breakdown
router.post('/:id/breakdown', breakdownTodo);

// DELETE /api/todos/:id
router.delete('/:id', deleteTodo);

module.exports = router;
