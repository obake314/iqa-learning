import { course } from "./course.js";
import { lesson as lessonCia } from "./lessons/01_security-cia/lesson.js";
import { summary as summaryCia } from "./lessons/01_security-cia/summary.js";
import { questions as questionsCia } from "./lessons/01_security-cia/questions.js";
import { lesson as lessonPassword } from "./lessons/02_security-password/lesson.js";
import { summary as summaryPassword } from "./lessons/02_security-password/summary.js";
import { questions as questionsPassword } from "./lessons/02_security-password/questions.js";

export default {
  ...course,
  lessons: [
    { ...lessonCia, summary: summaryCia, questions: questionsCia },
    { ...lessonPassword, summary: summaryPassword, questions: questionsPassword },
  ],
};
