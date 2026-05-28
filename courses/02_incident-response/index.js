import { course } from "./course.js";
import { lesson as lessonFirstAction } from "./lessons/01_incident-first-action/lesson.js";
import { summary as summaryFirstAction } from "./lessons/01_incident-first-action/summary.js";
import { questions as questionsFirstAction } from "./lessons/01_incident-first-action/questions.js";

export default {
  ...course,
  lessons: [
    { ...lessonFirstAction, summary: summaryFirstAction, questions: questionsFirstAction },
  ],
};
