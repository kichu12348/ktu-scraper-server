export interface Course {
  course: string;
  credits: string;
  grade: string;
  code?: string; // Optional, only available in the grade card view
  monthYear?: string; // Optional, only available in the grade card view
}

export interface GradesBySemester {
  semester: string;
  sgpa: string;
  totalCredits?: string; // Optional, only available in the grade card view
  earnedCredits?: string; // Optional, only available in the grade card view
  courses: Course[];
}

export function parseGradeCard(
  html: string,
  semester: string,
): GradesBySemester {
  const errorDivRegex = /<div[^>]*id="errorMainDiv"[^>]*>([\s\S]*?)<\/div>/i;
  // --- 1. CHECK FOR ERROR DIV (RESULTS NOT OUT) ---
  const errorMatch = html.match(errorDivRegex);
  if (errorMatch && errorMatch[1]) {
    const errorText = errorMatch[1]
      .replace(/<[^>]+>/g, "")
      .trim()
      .toLocaleLowerCase();
    if (errorText.includes("semester grade cards not available")) {
      return {
        courses: [],
        sgpa: "Not Available",
        totalCredits: "Not Available",
        earnedCredits: "Not Available",
        semester,
      };
    }
  }

  const tableBodyRegex = /<tbody[^>]*>([\s\S]*?)<\/tbody>/i;

  const tableBodyMatch = html.match(tableBodyRegex);
  if (!tableBodyMatch || !tableBodyMatch[1]) {
    throw new Error("No table body found in the grade card.");
  }
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;

  const trMatches = tableBodyMatch[1].match(trRegex);
  if (!trMatches) {
    throw new Error("No table rows found in the grade card.");
  }

  let sgpa = "Not Available";
  let totalCredits = "Not Available";
  let earnedCredits = "Not Available";

  const courses: Course[] = [];

  for (let i = 0; i < trMatches.length; i++) {
    const tr = trMatches[i];
    if (tr) {
      const tdMatches = tr.match(tdRegex);
      if (!tdMatches) {
        continue;
      }

      const firstColText = tdMatches[0]
        .replace(/<[^>]+>/g, "")
        .trim()
        .toLocaleLowerCase();

      if (tdMatches.length < 3) {
        if (firstColText.includes("sgpa")) {
          sgpa = tdMatches[1]?.replace(/<[^>]+>/g, "").trim() || sgpa;
        } else if (firstColText.includes("total credits in the semester")) {
          totalCredits =
            tdMatches[1]?.replace(/<[^>]+>/g, "").trim() || totalCredits;
        } else if (firstColText.includes("total earned credits")) {
          earnedCredits =
            tdMatches[1]?.replace(/<[^>]+>/g, "").trim() || earnedCredits;
        }
        continue;
      } else {
        const course = tdMatches[0].replace(/<[^>]+>/g, "").trim();
        const code = tdMatches[1]?.replace(/<[^>]+>/g, "").trim();
        const grade =
          tdMatches[2]?.replace(/<[^>]+>/g, "").trim() || "Not Available";
        const credits =
          tdMatches[3]?.replace(/<[^>]+>/g, "").trim() || "Not Available";
        const monthYear =
          tdMatches[4]?.replace(/<[^>]+>/g, "").trim() || "Not Available";
        courses.push({ course, code, grade, credits, monthYear });
      }
    }
  }

  return { courses, sgpa, totalCredits, earnedCredits, semester };
}
