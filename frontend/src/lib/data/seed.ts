import type { ColorKey, Confidence, Course, Topic, Workspace } from './types'

export function dateOnly(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** All demo dates move with the learner's local calendar, including across DST. */
export function createDemoWorkspace(now = new Date()): Workspace {
  const date = (days: number, hour = 14, minute = 0) => {
    const d = new Date(now)
    d.setDate(d.getDate() + days)
    d.setHours(hour, minute, 0, 0)
    return d
  }
  const instant = (days: number, hour = 14) => date(days, hour).toISOString()
  const day = (days: number) => dateOnly(date(days))
  const createdAt = instant(-54)
  type SeedTopic = [title: string, details: string, confidence: Confidence, reviewedDaysAgo: number | null, notes?: string]
  const courseSeeds: { code: string; name: string; color: ColorKey; topics: SeedTopic[]; url: string }[] = [
    { code: 'CSC369', name: 'Operating Systems', color: 'ember', url: 'https://pages.cs.wisc.edu/~remzi/OSTEP/', topics: [
      ['Processes and system calls', 'How programs cross the user and kernel boundary.', 'solid', 1],
      ['Threads and concurrency', 'Shared state, thread creation, and context switches.', 'solid', 2],
      ['CPU scheduling', 'Compare round robin, shortest job first, and priority scheduling.', 'solid', 8, 'Can trace round robin on paper. Do one mixed scheduling question before the midterm.'],
      ['Locks and condition variables', 'Coordinate threads without busy waiting.', 'solid', 1],
      ['Deadlocks', 'The four conditions and ways to break a waiting cycle.', 'okay', 2],
      ['Address translation', 'Trace a virtual address through page tables and the TLB.', 'shaky', 3, 'I keep mixing up the page offset and page number. Redo the two-level page table example from tutorial.'],
      ['Paging and replacement', 'Work through FIFO, LRU, and clock replacement traces.', 'shaky', 2, 'Clock replacement is still slow. Draw the reference bits at each step instead of guessing.'],
      ['Virtual memory', 'Demand paging, page faults, and working sets.', 'shaky', 1, 'Ask about copy-on-write at office hours. Need to explain what happens during a page fault without reading my notes.'],
      ['Memory-mapped files', 'Connect mmap, shared pages, and file-backed memory.', 'okay', 1],
      ['File systems', 'Inodes, directory entries, and block allocation.', 'unrated', null],
      ['Storage and crash recovery', 'Journaling and what survives a sudden shutdown.', 'unrated', null],
      ['I/O devices and interrupts', 'How the kernel handles device requests and completion.', 'unrated', null],
      ['Virtualization and isolation', 'Compare virtual machines, containers, and protection boundaries.', 'unrated', null],
    ] },
    { code: 'CSC324', name: 'Programming Languages', color: 'iris', url: 'https://docs.racket-lang.org/guide/', topics: [
      ['Functional programming in Racket', 'Functions as values and immutable list processing.', 'okay', 1],
      ['Recursion and folds', 'Replace repeated recursion patterns with folds.', 'solid', 2],
      ['Lexical scope and closures', 'Follow captured bindings through nested functions.', 'okay', 4, 'Draw the environment when the function is defined, not when it is called.'],
      ['Pattern matching', 'Decompose recursive data into small, explicit cases.', 'okay', 2],
      ['Lazy evaluation', 'When expressions are evaluated and how values are shared.', 'okay', 1],
      ['Type inference', 'Solve type constraints for small functional programs.', 'okay', 5, 'The substitution step finally clicked. Try the assignment example with a nested lambda again.'],
      ['Interpreters', 'Evaluate an expression tree with an environment.', 'shaky', 0, 'Just worked through eval and apply. Give it a day, then write the evaluator from memory.'],
      ['Continuations', 'Make the rest of a computation explicit.', 'okay', 1],
      ['Logic programming', 'Unification, relations, and backtracking search.', 'unrated', null],
      ['Macros', 'Transform syntax without accidentally capturing names.', 'unrated', null],
      ['Effects and language design', 'Compare explicit state, exceptions, and pure expressions.', 'unrated', null],
    ] },
    { code: 'CSC301', name: 'Intro to Software Engineering', color: 'teal', url: 'https://git-scm.com/book/en/v2', topics: [
      ['Requirements and user stories', 'Describe user goals and testable acceptance criteria.', 'solid', 2, 'Our project stories now have acceptance criteria. Keep each one small enough to demo.'],
      ['Git collaboration', 'Small branches, useful commits, and code reviews.', 'solid', 1],
      ['Sprint planning and team check-in', 'Agree on sprint scope, roles, and meeting times.', 'retired', null, 'Team admin, not assessed in the final. Sprint board is in the project repository.'],
      ['Software architecture', 'Choose boundaries that keep changes local.', 'okay', 4, 'Review the service boundaries before the API milestone. The auth module still knows too much about the database.'],
      ['Testing strategies', 'Balance unit, integration, and end-to-end tests.', 'solid', 3],
      ['Continuous integration', 'Build and verify each change automatically.', 'okay', 1, 'The team build runs now. Next step is to add the integration tests for the booking flow.'],
      ['Team contract and peer feedback', 'Record responsibilities and complete the peer feedback form.', 'retired', null, 'Submitted the team contract. Keep this for reference, no exam revision needed.'],
      ['Deployment and monitoring', 'Release the project and find production failures.', 'unrated', null],
      ['Project demo and retrospective', 'Prepare the demo and identify improvements for the next sprint.', 'unrated', null],
    ] },
    { code: 'CSC311', name: 'Intro to Machine Learning', color: 'amber', url: 'https://scikit-learn.org/stable/user_guide.html', topics: [
      ['Nearest neighbours', 'Predict using nearby examples and choose a useful distance.', 'solid', 1],
      ['Decision trees', 'Split the input space with simple questions.', 'okay', 0],
      ['Linear regression', 'Fit a line by minimizing squared prediction errors.', 'shaky', 1, 'Can use the normal equation, but deriving it with matrix calculus is still rough.'],
      ['Gradient descent', 'Update parameters in the direction that reduces loss.', 'shaky', 0, 'Spent an hour on learning rates today. The loss can increase if the step is too large.'],
      ['Logistic regression', 'Model a class probability with the sigmoid function.', 'okay', 2],
      ['Regularization', 'Control model complexity with penalties and validation.', 'shaky', 3, 'L1 versus L2 is fine in words. Need practice calculating the gradient with the penalty term.'],
      ['Neural networks', 'Compose layers and compute gradients with backpropagation.', 'shaky', 2, 'Lost a transpose in the backprop question. Write the shape of every matrix beside it.'],
      ['Probabilistic models', 'Connect likelihood, priors, and posterior probabilities.', 'okay', 0],
      ['Clustering', 'Find groups with k-means and compare initializations.', 'okay', 0],
      ['Principal component analysis', 'Project data onto directions with the most variance.', 'unrated', null],
      ['Mixture models and EM', 'Alternate between assigning examples and fitting distributions.', 'unrated', null],
      ['Ensembles', 'Combine weak models with bagging and boosting.', 'unrated', null],
    ] },
    { code: 'AST101', name: 'The Sun and Its Neighbours', color: 'sky', url: 'https://openstax.org/books/astronomy-2e/pages/1-introduction', topics: [
      ['The night sky', 'Use celestial coordinates and explain the seasons.', 'solid', 1],
      ['Light and spectra', 'Read temperatures and compositions from starlight.', 'solid', 2],
      ['Telescopes', 'Compare resolution and light gathering power.', 'solid', 4, 'Remember that a bigger mirror improves both resolution and light collection. Quick refresh before Midterm 2.'],
      ['The Sun', 'Follow energy from the core to the photosphere.', 'solid', 1],
      ['Stellar properties', 'Connect luminosity, radius, and surface temperature.', 'solid', 2],
      ['The H-R diagram', 'Place stars by luminosity and temperature.', 'okay', 1, 'Temperature runs backwards on the x-axis. Practice placing red giants and white dwarfs.'],
      ['Star formation', 'Trace a cloud of gas into a main-sequence star.', 'unrated', null],
      ['Stellar evolution', 'Compare the life cycles of low and high mass stars.', 'unrated', null],
    ] },
    { code: 'CSC364', name: 'Computability', color: 'slate', url: 'https://en.wikipedia.org/wiki/Computability_theory', topics: [
      ['Finite automata', 'Recognize regular languages with finite state machines.', 'retired', null],
      ['Regular expressions', 'Translate between expressions and automata.', 'retired', null],
      ['Context-free grammars', 'Generate nested structures with production rules.', 'retired', null],
      ['Turing machines', 'Represent computation with a tape and transition rules.', 'retired', null],
      ['Decidability', 'Separate problems that halt from those that may not.', 'retired', null],
      ['The halting problem', 'Use diagonalization to show an algorithm cannot exist.', 'retired', null],
      ['Reductions', 'Transform one decision problem into another.', 'retired', null],
      ['Complexity classes', 'Compare polynomial time and polynomial verification.', 'retired', null],
    ] },
  ]
  const courses: Course[] = courseSeeds.map((c, i) => ({
    id: `course-${c.code.toLowerCase()}`, code: c.code, name: c.name, color: c.color,
    term: `${now.getMonth() < 4 ? 'Winter' : now.getMonth() < 8 ? 'Summer' : 'Fall'} ${now.getFullYear()}`,
    instructor: null, email: null, website: c.url,
    status: i === 5 ? 'archived' : 'active', createdAt,
  }))
  const topics: Topic[] = []
  const reviews: Workspace['reviews'] = []
  courseSeeds.forEach((course, ci) => {
    let futureLecture = 0
    course.topics.forEach(([title, details, confidence, daysAgo, notes = ''], position) => {
      const id = `topic-${course.code.toLowerCase()}-${position + 1}`
      const future = confidence === 'unrated'
      const reviewed = daysAgo !== null
      // Today's check-ins must never land later than the supplied clock.
      const reviewTime = daysAgo === null ? null : date(-daysAgo, [9, 11, 16, 19][position % 4])
      const lastReviewedAt = reviewTime ? new Date(Math.min(reviewTime.getTime(), now.getTime())).toISOString() : null
      const futureDay = future ? (ci === 4 ? 1 : 2) + futureLecture++ * (ci === 4 ? 2 : 3) : null
      const blockDay = ci === 0 ? 0 : now.getDay() === 0 ? -1 : 1
      const plannedStart = ci < 2 && position === 5 ? instant(blockDay, ci === 0 ? 15 : 10) : null
      topics.push({
        id, courseId: courses[ci].id, title, details,
        notes,
        plannedDate: plannedStart ? dateOnly(new Date(plannedStart)) : day(futureDay ?? -45 + position * 4 + ci),
        plannedStart, plannedMinutes: plannedStart ? 50 : null,
        confidence, lastReviewedAt, position,
        resources: position % 3 === 0 || position === 5 ? [
          { id: `resource-${id}-1`, label: ci === 0 ? 'Operating Systems: Three Easy Pieces' : `${course.name} reading`, url: course.url },
          ...(position === 5 ? [{ id: `resource-${id}-2`, label: 'Background and definitions', url: `https://en.wikipedia.org/wiki/${ci === 0 ? 'Virtual_memory' : ci === 1 ? 'Type_inference' : ci === 2 ? 'Continuous_integration' : ci === 3 ? 'Regularization_(mathematics)' : 'Hertzsprung%E2%80%93Russell_diagram'}` }] : []),
        ] : [], createdAt,
      })
      if (reviewed) {
        const firstRating = confidence === 'solid' ? 'okay' : position % 2 === 0 ? 'shaky' : 'okay'
        reviews.push({ id: `review-${id}-1`, topicId: id, previous: 'unrated', rating: firstRating, at: instant(-daysAgo! - 6, 11), source: 'topic' })
        reviews.push({ id: `review-${id}-2`, topicId: id, previous: firstRating, rating: confidence, at: lastReviewedAt!, source: position % 2 ? 'focus' : 'review' })
      }
    })
  })
  const assessment = (ci: number, suffix: string, title: string, kind: Workspace['assessments'][number]['kind'], due: number, weight: number, done = false): Workspace['assessments'][number] => ({
    id: `assessment-${suffix}`, courseId: courses[ci].id, title, kind, dueDate: day(due), dueTime: kind === 'exam' ? '14:00' : '23:59', weight,
    done, doneAt: done ? instant(due - 1) : null,
    notes: kind === 'exam' ? 'Bring student ID. Practice the tutorial questions and review the shaky topics first.' : '',
    topicIds: topics.filter(t => t.courseId === courses[ci].id).slice(2, 8).map(t => t.id), createdAt,
  })
  return {
    user: { id: 'demo-student', username: 'Alex', createdAt }, courses, topics, reviews,
    assessments: [
      assessment(4, 'ast-midterm', 'AST101 Midterm 2', 'exam', 5, 25),
      assessment(0, 'os-midterm', 'CSC369 Midterm 2', 'exam', 12, 25),
      assessment(1, 'racket-a2', 'CSC324 Assignment 2', 'assignment', -2, 12),
      assessment(3, 'ml-a2', 'CSC311 Assignment 2', 'assignment', -4, 10, true),
      assessment(2, 'project', 'Team project: API milestone', 'project', 8, 15),
      assessment(4, 'astro-quiz', 'AST101 Weekly quiz', 'quiz', 2, 2),
      assessment(0, 'os-tutorial', 'Finish scheduling tutorial', 'task', 1, 0),
      assessment(3, 'ml-quiz', 'CSC311 Practice quiz', 'quiz', 6, 2),
    ],
    events: [
      { id: 'event-club', title: 'Photography club', date: day(1), startTime: '18:00', endTime: '19:30', color: 'orchid', done: false },
      { id: 'event-work', title: 'Library shift', date: day(3), startTime: '16:00', endTime: '20:00', color: 'slate', done: false },
      { id: 'event-groceries', title: 'Groceries with Sam', date: day(0), startTime: '17:30', endTime: '18:15', color: 'moss', done: false },
    ],
    sessions: ([
      ['CSC369', 1, 20, 45, 'Traced fork and exec by hand.'],
      ['CSC324', 3, 18, 30, 'Environment diagrams for the closure exercises.'],
      ['AST101', 4, 17, 25, null],
      ['CSC311', 3, 15, 50, 'The matrix derivative needs another pass.'],
      ['CSC369', 5, 14, 45, null],
      ['CSC301', 1, 12, 30, 'Rewrote the acceptance criteria for our project.'],
      ['CSC311', 4, 11, 60, 'Compared loss curves for different learning rates.'],
      ['CSC324', 5, 9, 40, null],
      ['CSC369', 6, 8, 50, 'Ran out of time on the page-table question.'],
      ['CSC311', 6, 7, 50, null],
      ['CSC301', 6, 5, 25, 'Got the integration test running in CI.'],
      ['CSC369', 7, 4, 60, 'Worked through the clock replacement trace twice.'],
      ['AST101', 6, 3, 25, 'Quick H-R diagram practice before the quiz.'],
      ['CSC311', 7, 2, 50, 'Checked the dimensions at each backprop step.'],
      ['CSC369', 8, 1, 45, 'Page faults and copy-on-write. Still need office hours.'],
    ] satisfies [string, number, number, number, string | null][]).map(([code, topicNumber, daysAgo, minutes, note], i) => ({
      id: `session-${i + 1}`, topicId: `topic-${code.toLowerCase()}-${topicNumber}`, courseId: `course-${code.toLowerCase()}`,
      startedAt: instant(-daysAgo, 10 + i % 5), minutes, note,
    })),
    generatedAt: now.toISOString(),
  }
}
