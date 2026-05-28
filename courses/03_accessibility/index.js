import { course } from "./course.js";
import { lesson as lessonBasics } from "./lessons/01_accessibility-basics/lesson.js";
import { summary as summaryBasics } from "./lessons/01_accessibility-basics/summary.js";
import { questions as questionsBasics } from "./lessons/01_accessibility-basics/questions.js";
import { lesson as lessonSemantic } from "./lessons/02_semantic-html/lesson.js";
import { summary as summarySemantic } from "./lessons/02_semantic-html/summary.js";
import { questions as questionsSemantic } from "./lessons/02_semantic-html/questions.js";
import { lesson as lessonColor } from "./lessons/03_color-and-form/lesson.js";
import { summary as summaryColor } from "./lessons/03_color-and-form/summary.js";
import { questions as questionsColor } from "./lessons/03_color-and-form/questions.js";

export default {
  ...course,
  lessons: [
    { ...lessonBasics, summary: summaryBasics, questions: questionsBasics },
    { ...lessonSemantic, summary: summarySemantic, questions: questionsSemantic },
    { ...lessonColor, summary: summaryColor, questions: questionsColor },
  ],
};
