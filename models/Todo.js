const mongoose = require('mongoose');

const todoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true },
  description: { type: String },
  date: { type: Date, required: true },
  timeSlot: { type: String }, // e.g., "10:00 AM - 11:00 AM"
  priority: { type: String, enum: ['High', 'Medium', 'Low'], default: 'Medium' },
  category: { type: String, enum: ['Study', 'Work', 'Personal', 'Health', 'Other'], default: 'Personal' },
  isCompleted: { type: Boolean, default: false },
  order: { type: Number, default: 0 },
  tags: [{ type: String }]
}, { timestamps: true });

module.exports = mongoose.model('Todo', todoSchema);
