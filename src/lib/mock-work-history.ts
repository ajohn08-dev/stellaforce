import type { WorkHistoryEntry } from "@/lib/work-history"

/**
 * UI-preview data only — candidates.work_history isn't a real column yet.
 * Keyed by candidate_id so the profile page can look a candidate up. Once
 * the schema/UI are approved, this goes away in favor of real DB data.
 */
export const MOCK_WORK_HISTORY: Record<string, WorkHistoryEntry[]> = {
  // Khanh Le
  "6bb5e7b2-0014-41e2-a54d-96bf1e048a97": [
    {
      company: "Apple",
      title: "Software Engineer",
      location: "Cupertino, CA",
      start_date: "2023-11",
      end_date: null,
      description: "Special Project Group (SPG) data ingestion pipelines (Python).",
    },
    {
      company: "Dolby Laboratories",
      title: "Software Engineer",
      location: "Santa Clara, CA",
      start_date: "2021-06",
      end_date: "2023-10",
      description: "Dolby Vision encoder SDK (C/C++, Python).",
    },
    {
      company: "Tesla",
      title: "Software Engineer",
      location: "Austin, TX",
      start_date: "2020-01",
      end_date: "2021-05",
      description: "Firmware tooling for battery management systems.",
    },
  ],
  // Maria Rodriguez
  "ce0f7133-fdf4-48e9-aaaf-021efc72e0f4": [
    {
      company: "Google",
      title: "Senior Data Scientist",
      location: "Mountain View, CA",
      start_date: "2022-01",
      end_date: null,
      description: "ML infrastructure for ads ranking systems.",
    },
    {
      company: "Meta",
      title: "Data Scientist",
      location: "Menlo Park, CA",
      start_date: "2019-03",
      end_date: "2021-12",
      description: "Built the experimentation platform for News Feed ranking.",
    },
  ],
  // James Park
  "a9ce90fa-ed48-4d93-86d4-b00faa6b8ec8": [
    {
      company: "Tesla",
      title: "Machine Learning Engineer",
      location: "Austin, TX",
      start_date: "2023-02",
      end_date: null,
      description: "Computer vision models for the Autopilot perception stack.",
    },
    {
      company: "NVIDIA",
      title: "Machine Learning Engineer",
      location: "Santa Clara, CA",
      start_date: "2021-01",
      end_date: "2023-01",
      description: "Trained perception models for autonomous-vehicle simulation.",
    },
  ],
  // Sarah Chen
  "ad3d983a-236d-4d96-8b9a-48912f9b3ec6": [
    {
      company: "Vertex Labs",
      title: "Senior Frontend Engineer",
      location: "San Francisco, CA",
      start_date: "2022-04",
      end_date: null,
      description: "Leading a UI platform rebuild on React with a new design system.",
    },
    {
      company: "Brightline Software",
      title: "Frontend Engineer",
      location: "Remote",
      start_date: "2019-01",
      end_date: "2022-03",
      description: "Built and maintained the customer-facing dashboard product.",
    },
    {
      company: "PixelForge",
      title: "Junior Frontend Developer",
      location: "Seattle, WA",
      start_date: "2017-06",
      end_date: "2018-12",
      description: "React component library and marketing site.",
    },
  ],
  // Marcus Johnson
  "b9cf4fcf-7908-43fa-8c4a-098d2ca52e5b": [
    {
      company: "Northwind Studio",
      title: "Product Designer",
      location: "Chicago, IL",
      start_date: "2023-01",
      end_date: null,
      description: "Owns design for B2B SaaS workflows end to end.",
    },
    {
      company: "Uber",
      title: "Product Designer",
      location: "San Francisco, CA",
      start_date: "2021-02",
      end_date: "2022-12",
      description: "Designed driver-side rider-matching flows.",
    },
    {
      company: "Freelance",
      title: "Contract Designer",
      location: "Remote",
      start_date: "2020-01",
      end_date: "2021-01",
      description: "Contract UX work for early-stage startups.",
    },
  ],
}
