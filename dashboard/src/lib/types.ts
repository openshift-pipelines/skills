export interface SprintMeta {
  team: string
  sprint: { id: number; name: string; startDate: string; endDate: string }
  generatedAt: string
  jiraBaseUrl: string
}

export interface StatusBreakdown {
  [status: string]: { count: number; sp: number }
}

export interface Summary {
  totalIssues: number
  totalSPs: number
  byStatus: StatusBreakdown
  blocked: { count: number; sp: number }
  noStoryPoints: number
}

export interface VelocityHistory {
  sprint: string
  committed: number
  completed: number
  carried: number
}

export interface Velocity {
  current: { committed: number; completed: number }
  history: VelocityHistory[]
  avg3: number | null
  avg5: number | null
  trend: string
  commitmentAccuracy: number[]
}

export interface Expectations {
  overCommitted: { flag: boolean; committed: number; avgVelocity: number; delta: number }
  underCommitted: { flag: boolean }
  carryForwardRate: number[]
  codeReviewBottleneck: { flag: boolean; percent: number }
}

export interface RoadmapSegment {
  count: number
  sp: number
  percent: number
}

export interface EpicProgress {
  key: string
  summary: string
  completedSP: number
  totalSP: number
}

export interface Roadmap {
  planned: RoadmapSegment
  unplanned: RoadmapSegment
  cve: RoadmapSegment
  epics: EpicProgress[]
  alignmentTrend: number[]
  untrackedCount: number
}

export interface DoDIssue {
  key: string
  summary: string
  status: string
  score: 'complete' | 'atRisk' | 'incomplete' | 'na'
  missing: string[]
}

export interface DoD {
  complete: { count: number; percent: number }
  atRisk: { count: number; percent: number }
  incomplete: { count: number; percent: number }
  na: { count: number; percent: number }
  issues: DoDIssue[]
}

export interface CodeReviewItem {
  key: string
  summary: string
  currentSP: number
  originalSP: number | null
  suggestedSP: number
  assignee: string
  alreadyReestimated: boolean
}

export interface BlockedItem {
  key: string
  summary: string
  priority: string
  reason: string
  assignee: string
}

export interface BugItem {
  key: string
  summary: string
  priority: string
  status: string
  proximity: 'done' | 'near' | 'mid' | 'far'
}

export interface CarryForwardItem {
  key: string
  summary: string
  sprintCount: number
  status: string
  severity: 'normal' | 'warning' | 'critical'
  latestComment: string
}

export interface FutureSprintItem {
  rank: number
  key: string
  summary: string
  type: string
  priority: string
}

export interface AssigneeData {
  totalIssues: number
  totalSP: number
  byStatus: StatusBreakdown
  blocked: number
  carryForwardCount: number
  issues: { key: string; summary: string; status: string; sp: number }[]
}

export interface ComponentData {
  totalIssues: number
  totalSP: number
  byStatus: StatusBreakdown
  blocked: number
  carryForward: unknown[]
  highPriorityBugs: number
  issues: { key: string; summary: string; status: string; sp: number; priority: string }[]
}

export interface DashboardData {
  meta: SprintMeta
  summary: Summary
  velocity: Velocity
  expectations: Expectations
  roadmap: Roadmap
  dod: DoD
  codeReview: CodeReviewItem[]
  blocked: BlockedItem[]
  highPriorityBugs: BugItem[]
  carryForward: CarryForwardItem[]
  futureSprint: { name: string; issues: FutureSprintItem[] }
  assignees: Record<string, AssigneeData>
  components: Record<string, ComponentData>
  daysRemaining: number
  sprintDuration: number
  sprintDay: number
  completionPercent: number
  healthScore: 'green' | 'yellow' | 'red'
  trends: {
    sprintSnapshots: SprintSnapshot[]
    issueSnapshots: IssueSnapshot[]
  }
}

// Analytics types
export interface SprintSnapshot {
  sprintName: string
  snapshotDate: string
  totalIssues: number
  totalSPs: number
  completedSPs: number
  completionPercent: number
  blockedCount: number
  codeReviewSPs: number
  carryForwardCount: number
  dodCompletePercent: number
  dodAtRiskPercent?: number
  plannedPercent: number
  unplannedPercent: number
  cvePercent: number
  healthScore: string
}

export interface IssueSnapshot {
  key: string
  summary: string
  status: string
  priority: string
  type: string
  assignee: string
  components: string[]
  storyPoints: number
  sprintCount: number
  sprintName: string
  snapshotDate: string
  dodScore: string
}

export interface AnalyticsData {
  meta: { team: string; generatedAt: string }
  sprintSnapshots: SprintSnapshot[]
  issueSnapshots: IssueSnapshot[]
}
