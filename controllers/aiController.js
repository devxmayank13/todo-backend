const { GoogleGenAI } = require('@google/genai');
const Todo = require('../models/Todo');

// Initialize Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

exports.generatePlan = async (req, res) => {
  try {
    const { goal, durationDays, dailyHours, startDate } = req.body;

    if (!goal || !durationDays || !dailyHours || !startDate) {
      return res.status(400).json({ message: 'Missing required fields: goal, durationDays, dailyHours, startDate' });
    }

    // User-defined prompt format with strict JSON schema
    const prompt = `
You are a productivity planner AI.

Generate a structured daily plan based on the following inputs:
- Goal: ${goal}
- Duration: ${durationDays} days
- Daily available time: ${dailyHours} hours

Rules:
- Break each day into clear time slots
- Include variety (learning, practice, revision)
- Keep workload realistic
- Prioritize important tasks

Output STRICTLY in JSON format like this:

{
  "plan": [
    {
      "day": 1,
      "tasks": [
        {
          "title": "Learn Arrays",
          "description": "Brief explanation of what to do in this session",
          "startTime": "09:00",
          "endTime": "11:00",
          "priority": "High",
          "category": "Study"
        }
      ]
    }
  ]
}

Allowed priority values: "High", "Medium", "Low"
Allowed category values: "Study", "Work", "Personal", "Health", "Other"
Ensure the total time per day does not exceed ${dailyHours} hours.
Output ONLY the JSON. No markdown, no explanation text outside the JSON.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const aiText = response.text;

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiText);
    } catch (parseErr) {
      console.error('Failed to parse AI response:', aiText);
      return res.status(500).json({ message: 'Failed to parse AI response into valid JSON' });
    }

    const planDays = parsedResponse.plan;
    if (!planDays || !Array.isArray(planDays)) {
      return res.status(500).json({ message: 'AI returned an invalid plan structure' });
    }

    const baseDate = new Date(startDate);
    const todosToInsert = [];

    for (const dayEntry of planDays) {
      const taskDate = new Date(baseDate);
      taskDate.setDate(taskDate.getDate() + (dayEntry.day - 1));

      for (const task of dayEntry.tasks) {
        const timeSlot = task.startTime && task.endTime
          ? `${task.startTime} - ${task.endTime}`
          : undefined;

        todosToInsert.push({
          userId: req.user.id,
          title: task.title,
          description: task.description || '',
          date: taskDate,
          timeSlot,
          priority: ['High', 'Medium', 'Low'].includes(task.priority) ? task.priority : 'Medium',
          category: ['Study', 'Work', 'Personal', 'Health', 'Other'].includes(task.category) ? task.category : 'Other',
          isCompleted: false,
        });
      }
    }

    const insertedTodos = await Todo.insertMany(todosToInsert);

    // Return the raw plan + saved todos for the frontend to display
    res.json({
      message: 'Plan generated and saved successfully',
      plan: planDays,
      todos: insertedTodos,
    });
  } catch (err) {
    console.error('AI Planner Error:', err);
    res.status(500).json({ message: 'Server error during AI generation', error: err.message });
  }
};
