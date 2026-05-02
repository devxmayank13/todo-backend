const Todo = require('../models/Todo');
const { GoogleGenAI } = require('@google/genai');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * GET /api/todos
 * Fetch todos for logged-in user.
 * Supports ?date=YYYY-MM-DD, ?category=, ?priority= filters.
 */
exports.getTodos = async (req, res) => {
  try {
    const { date, category, priority } = req.query;
    const query = { userId: req.user.id };

    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(date);
      end.setHours(23, 59, 59, 999);
      query.date = { $gte: start, $lte: end };
    }
    if (category) query.category = category;
    if (priority) query.priority = priority;

    const todos = await Todo.find(query).sort({ date: 1, timeSlot: 1 });
    res.json(todos);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * GET /api/todos/stats
 * Return dashboard statistics for the logged-in user.
 */
exports.getStats = async (req, res) => {
  try {
    const userId = req.user.id;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const [total, completed, todayTotal, todayCompleted] = await Promise.all([
      Todo.countDocuments({ userId }),
      Todo.countDocuments({ userId, isCompleted: true }),
      Todo.countDocuments({ userId, date: { $gte: todayStart, $lte: todayEnd } }),
      Todo.countDocuments({ userId, date: { $gte: todayStart, $lte: todayEnd }, isCompleted: true }),
    ]);

    res.json({
      total,
      completed,
      pending: total - completed,
      todayTotal,
      todayCompleted,
      todayPending: todayTotal - todayCompleted,
      overallProgress: total > 0 ? Math.round((completed / total) * 100) : 0,
      todayProgress: todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * POST /api/todos
 * Create a new task.
 */
exports.createTodo = async (req, res) => {
  try {
    const newTodo = new Todo({ ...req.body, userId: req.user.id });
    const todo = await newTodo.save();
    res.status(201).json(todo);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * PUT /api/todos/:id
 * Update a task (status, title, etc.).
 */
exports.updateTodo = async (req, res) => {
  try {
    let todo = await Todo.findById(req.params.id);
    if (!todo) return res.status(404).json({ message: 'Todo not found' });
    if (todo.userId.toString() !== req.user.id)
      return res.status(401).json({ message: 'Not authorized' });

    todo = await Todo.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true });
    res.json(todo);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * DELETE /api/todos/:id
 * Delete a task.
 */
exports.deleteTodo = async (req, res) => {
  try {
    const todo = await Todo.findById(req.params.id);
    if (!todo) return res.status(404).json({ message: 'Todo not found' });
    if (todo.userId.toString() !== req.user.id)
      return res.status(401).json({ message: 'Not authorized' });

    await Todo.findByIdAndDelete(req.params.id);
    res.json({ message: 'Todo removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * PUT /api/todos/reorder
 * Reorder an array of tasks.
 */
exports.reorderTodos = async (req, res) => {
  try {
    const { items } = req.body; // array of { id, order }
    if (!items || !Array.isArray(items)) return res.status(400).json({ message: 'Invalid items array' });
    
    const updates = items.map(item => 
      Todo.updateOne(
        { _id: item.id, userId: req.user.id },
        { $set: { order: item.order } }
      )
    );
    await Promise.all(updates);
    res.json({ message: 'Reordered successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

/**
 * POST /api/todos/:id/breakdown
 * Use AI to break a task down into subtasks.
 */
exports.breakdownTodo = async (req, res) => {
  try {
    const parent = await Todo.findById(req.params.id);
    if (!parent) return res.status(404).json({ message: 'Todo not found' });
    if (parent.userId.toString() !== req.user.id) return res.status(401).json({ message: 'Not authorized' });

    const prompt = `
You are a productivity AI. Break down the following task into exactly 3 smaller, actionable sub-tasks.
Task: "${parent.title}"
Description: "${parent.description || ''}"

Output strictly in JSON format like this:
{
  "subtasks": [
    { "title": "Subtask 1", "description": "Brief desc" },
    { "title": "Subtask 2", "description": "Brief desc" },
    { "title": "Subtask 3", "description": "Brief desc" }
  ]
}
Output ONLY the JSON. No markdown.
`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json' },
    });

    const parsed = JSON.parse(response.text);
    if (!parsed.subtasks || !Array.isArray(parsed.subtasks)) throw new Error('Invalid AI response structure');

    const todosToInsert = parsed.subtasks.map(sub => ({
      userId: req.user.id,
      title: sub.title,
      description: sub.description || '',
      date: parent.date, // Inherit parent's date
      priority: parent.priority, // Inherit parent's priority
      category: parent.category, // Inherit parent's category
      order: parent.order + 1 // Place them immediately after
    }));

    const inserted = await Todo.insertMany(todosToInsert);
    res.json({ message: 'Breakdown successful', newTodos: inserted });
  } catch (err) {
    res.status(500).json({ message: 'Server error during breakdown', error: err.message });
  }
};
