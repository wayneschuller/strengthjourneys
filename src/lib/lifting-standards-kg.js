"use client";
// Data for lifting standards is based on the research of Professor Lon Kilgore
// https://lonkilgore.com/
// Use the kg data and convert to elsewhere when needed
// prettier-ignore
export const LiftingStandardsKG = [
  // Age 15-19 Squat Standards we mark as age 18 and interpolate
  { age: 18, liftType: "Back Squat", gender: "male", bodyWeight: 57, physicallyActive: 34, beginner: 59, intermediate: 78, advanced: 107, elite: 136, },
  { age: 18, liftType: "Back Squat", gender: "male", bodyWeight: 68, physicallyActive: 38, beginner: 65, intermediate: 87, advanced: 120, elite: 158, },
  { age: 18, liftType: "Back Squat", gender: "male", bodyWeight: 79, physicallyActive: 46, beginner: 80, intermediate: 106, advanced: 146, elite: 192, },
  { age: 18, liftType: "Back Squat", gender: "male", bodyWeight: 91, physicallyActive: 49, beginner: 85, intermediate: 113, advanced: 155, elite: 205, },
  { age: 18, liftType: "Back Squat", gender: "male", bodyWeight: 102, physicallyActive: 52, beginner: 89, intermediate: 118, advanced: 162, elite: 209, },
  { age: 18, liftType: "Back Squat", gender: "male", bodyWeight: 113, physicallyActive: 53, beginner: 90, intermediate: 120, advanced: 165, elite: 213, },
  { age: 18, liftType: "Back Squat", gender: "male", bodyWeight: 136, physicallyActive: 56, beginner: 97, intermediate: 129, advanced: 177, elite: 219, },
  { age: 18, liftType: "Back Squat", gender: "female", bodyWeight: 57, physicallyActive: 23, beginner: 32, intermediate: 44, advanced: 61, elite: 84 },
  { age: 18, liftType: "Back Squat", gender: "female", bodyWeight: 68, physicallyActive: 29, beginner: 41, intermediate: 56, advanced: 77, elite: 106 },
  { age: 18, liftType: "Back Squat", gender: "female", bodyWeight: 79, physicallyActive: 32, beginner: 44, intermediate: 61, advanced: 84, elite: 116 },
  { age: 18, liftType: "Back Squat", gender: "female", bodyWeight: 91, physicallyActive: 35, beginner: 48, intermediate: 66, advanced: 91, elite: 126 },
  { age: 18, liftType: "Back Squat", gender: "female", bodyWeight: 102, physicallyActive: 35, beginner: 48, intermediate: 66, advanced: 91, elite: 125 },
  { age: 18, liftType: "Back Squat", gender: "female", bodyWeight: 113, physicallyActive: 36, beginner: 49, intermediate: 68, advanced: 94, elite: 130 },
  { age: 18, liftType: "Back Squat", gender: "female", bodyWeight: 136, physicallyActive: 53, beginner: 73, intermediate: 100, advanced: 138, elite: 190 },
  // Age 80-89 Squat Standards we mark as age 85 and interpolate
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 57, physicallyActive: 18, beginner: 30, intermediate: 40, advanced: 55, elite: 73, },
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 68, physicallyActive: 24, beginner: 40, intermediate: 54, advanced: 74, elite: 97, },
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 79, physicallyActive: 26, beginner: 44, intermediate: 59, advanced: 81, elite: 107, },
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 91, physicallyActive: 27, beginner: 46, intermediate: 62, advanced: 85, elite: 112, },
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 102, physicallyActive: 28, beginner: 46, intermediate: 62, advanced: 86, elite: 113, },
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 113, physicallyActive: 28, beginner: 47, intermediate: 63, advanced: 87, elite: 115, },
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 136, physicallyActive: 28, beginner: 49, intermediate: 65, advanced: 89, elite: 117, },
  { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 57, physicallyActive: 11, beginner: 19, intermediate: 25, advanced: 35, elite: 46 },
  { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 68, physicallyActive: 11, beginner: 20, intermediate: 26, advanced: 36, elite: 48 },
  { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 79, physicallyActive: 12, beginner: 21, intermediate: 28, advanced: 39, elite: 52 },
  { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 91, physicallyActive: 13, beginner: 23, intermediate: 30, advanced: 41, elite: 54 },
  { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 102, physicallyActive: 13, beginner: 23, intermediate: 31, advanced: 42, elite: 56 },
  { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 113, physicallyActive: 14, beginner: 24, intermediate: 32, advanced: 43, elite: 57 },
  { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 136, physicallyActive: 14, beginner: 24, intermediate: 32, advanced: 43, elite: 57 },

  // Bench Press Male Section
  // Age 15-19 Bench Press Standards we mark as age 18 and interpolate
  { age: 18, liftType: "Bench Press", gender: "male", bodyWeight: 57, physicallyActive: 34, beginner: 47, intermediate: 61, advanced: 74, elite: 85, },
  { age: 18, liftType: "Bench Press", gender: "male", bodyWeight: 68, physicallyActive: 42, beginner: 59, intermediate: 75, advanced: 92, elite: 107, },
  { age: 18, liftType: "Bench Press", gender: "male", bodyWeight: 79, physicallyActive: 43, beginner: 60, intermediate: 77, advanced: 94, elite: 110, },
  { age: 18, liftType: "Bench Press", gender: "male", bodyWeight: 90, physicallyActive: 50, beginner: 71, intermediate: 91, advanced: 111, elite: 132, },
  { age: 18, liftType: "Bench Press", gender: "male", bodyWeight: 102, physicallyActive: 53, beginner: 74, intermediate: 95, advanced: 116, elite: 134, },
  { age: 18, liftType: "Bench Press", gender: "male", bodyWeight: 113, physicallyActive: 53, beginner: 74, intermediate: 96, advanced: 117, elite: 137, },
  { age: 18, liftType: "Bench Press", gender: "male", bodyWeight: 136, physicallyActive: 53, beginner: 74, intermediate: 95, advanced: 116, elite: 138, },

  // Age 80-89 Bench Press Standards we mark as age 85 and interpolate
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 57, physicallyActive: 16, beginner: 22, intermediate: 28, advanced: 34, elite: 41, },
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 68, physicallyActive: 20, beginner: 28, intermediate: 36, advanced: 44, elite: 54, },
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 79, physicallyActive: 22, beginner: 31, intermediate: 40, advanced: 49, elite: 61, },
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 91, physicallyActive: 24, beginner: 33, intermediate: 43, advanced: 52, elite: 65, },
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 102, physicallyActive: 25, beginner: 35, intermediate: 45, advanced: 55, elite: 69, },
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 113, physicallyActive: 30, beginner: 42, intermediate: 54, advanced: 66, elite: 83, },
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 136, physicallyActive: 33, beginner: 46, intermediate: 59, advanced: 72, elite: 91, },

 
 // Bench Press Female Section
 // Age 15-19 (midpoint 17)
  { age: 17, liftType: "Bench Press", gender: "female", bodyWeight: 57, physicallyActive: 14, beginner: 19, intermediate: 27, advanced: 37, elite: 51 },
  { age: 17, liftType: "Bench Press", gender: "female", bodyWeight: 68, physicallyActive: 17, beginner: 23, intermediate: 32, advanced: 44, elite: 61 },
  { age: 17, liftType: "Bench Press", gender: "female", bodyWeight: 79, physicallyActive: 19, beginner: 27, intermediate: 37, advanced: 51, elite: 70 },
  { age: 17, liftType: "Bench Press", gender: "female", bodyWeight: 91, physicallyActive: 21, beginner: 28, intermediate: 39, advanced: 54, elite: 75 },
  { age: 17, liftType: "Bench Press", gender: "female", bodyWeight: 102, physicallyActive: 22, beginner: 30, intermediate: 41, advanced: 57, elite: 78 },
  { age: 17, liftType: "Bench Press", gender: "female", bodyWeight: 113, physicallyActive: 22, beginner: 31, intermediate: 42, advanced: 58, elite: 81 },
  { age: 17, liftType: "Bench Press", gender: "female", bodyWeight: 136, physicallyActive: 23, beginner: 32, intermediate: 44, advanced: 61, elite: 84 },

  // Age 20-29 (midpoint 25)
  { age: 25, liftType: "Bench Press", gender: "female", bodyWeight: 57, physicallyActive: 14, beginner: 19, intermediate: 26, advanced: 36, elite: 49 },
  { age: 25, liftType: "Bench Press", gender: "female", bodyWeight: 68, physicallyActive: 19, beginner: 27, intermediate: 37, advanced: 51, elite: 70 },
  { age: 25, liftType: "Bench Press", gender: "female", bodyWeight: 79, physicallyActive: 21, beginner: 29, intermediate: 40, advanced: 56, elite: 77 },
  { age: 25, liftType: "Bench Press", gender: "female", bodyWeight: 91, physicallyActive: 22, beginner: 30, intermediate: 42, advanced: 57, elite: 79 },
  { age: 25, liftType: "Bench Press", gender: "female", bodyWeight: 102, physicallyActive: 25, beginner: 34, intermediate: 47, advanced: 64, elite: 89 },
  { age: 25, liftType: "Bench Press", gender: "female", bodyWeight: 113, physicallyActive: 25, beginner: 35, intermediate: 48, advanced: 66, elite: 91 },
  { age: 25, liftType: "Bench Press", gender: "female", bodyWeight: 136, physicallyActive: 28, beginner: 39, intermediate: 54, advanced: 75, elite: 103 },

  // Age 30-39 (midpoint 35)
  { age: 35, liftType: "Bench Press", gender: "female", bodyWeight: 57, physicallyActive: 12, beginner: 17, intermediate: 22, advanced: 27, elite: 57 },
  { age: 35, liftType: "Bench Press", gender: "female", bodyWeight: 68, physicallyActive: 30, beginner: 41, intermediate: 53, advanced: 65, elite: 83 },
  { age: 35, liftType: "Bench Press", gender: "female", bodyWeight: 79, physicallyActive: 33, beginner: 45, intermediate: 60, advanced: 73, elite: 89 },
  { age: 35, liftType: "Bench Press", gender: "female", bodyWeight: 91, physicallyActive: 35, beginner: 51, intermediate: 66, advanced: 80, elite: 98 },
  { age: 35, liftType: "Bench Press", gender: "female", bodyWeight: 102, physicallyActive: 38, beginner: 51, intermediate: 67, advanced: 84, elite: 100 },
  { age: 35, liftType: "Bench Press", gender: "female", bodyWeight: 113, physicallyActive: 39, beginner: 52, intermediate: 66, advanced: 86, elite: 102 },
  { age: 35, liftType: "Bench Press", gender: "female", bodyWeight: 136, physicallyActive: 41, beginner: 58, intermediate: 74, advanced: 90, elite: 106 },

  // Age 40-49 (midpoint 45)
  { age: 45, liftType: "Bench Press", gender: "female", bodyWeight: 57, physicallyActive: 14, beginner: 14, intermediate: 25, advanced: 25, elite: 46 },
  { age: 45, liftType: "Bench Press", gender: "female", bodyWeight: 68, physicallyActive: 20, beginner: 31, intermediate: 36, advanced: 56, elite: 66 },
  { age: 45, liftType: "Bench Press", gender: "female", bodyWeight: 79, physicallyActive: 23, beginner: 37, intermediate: 41, advanced: 67, elite: 75 },
  { age: 45, liftType: "Bench Press", gender: "female", bodyWeight: 91, physicallyActive: 24, beginner: 44, intermediate: 44, advanced: 80, elite: 81 },
  { age: 45, liftType: "Bench Press", gender: "female", bodyWeight: 102, physicallyActive: 26, beginner: 32, intermediate: 44, advanced: 59, elite: 85 },
  { age: 45, liftType: "Bench Press", gender: "female", bodyWeight: 113, physicallyActive: 26, beginner: 41, intermediate: 48, advanced: 75, elite: 87 },
  { age: 45, liftType: "Bench Press", gender: "female", bodyWeight: 136, physicallyActive: 28, beginner: 44, intermediate: 51, advanced: 79, elite: 93 },

  // Age 50-59 (midpoint 55)
  { age: 55, liftType: "Bench Press", gender: "female", bodyWeight: 57, physicallyActive: 7, beginner: 13, intermediate: 17, advanced: 23, elite: 43 },
  { age: 55, liftType: "Bench Press", gender: "female", bodyWeight: 68, physicallyActive: 16, beginner: 22, intermediate: 32, advanced: 37, elite: 61 },
  { age: 55, liftType: "Bench Press", gender: "female", bodyWeight: 79, physicallyActive: 18, beginner: 30, intermediate: 40, advanced: 55, elite: 68 },
  { age: 55, liftType: "Bench Press", gender: "female", bodyWeight: 91, physicallyActive: 18, beginner: 31, intermediate: 41, advanced: 56, elite: 69 },
  { age: 55, liftType: "Bench Press", gender: "female", bodyWeight: 102, physicallyActive: 15, beginner: 27, intermediate: 35, advanced: 49, elite: 72 },
  { age: 55, liftType: "Bench Press", gender: "female", bodyWeight: 113, physicallyActive: 18, beginner: 32, intermediate: 42, advanced: 58, elite: 75 },
  { age: 55, liftType: "Bench Press", gender: "female", bodyWeight: 136, physicallyActive: 21, beginner: 36, intermediate: 48, advanced: 66, elite: 82 },

  // Age 60-69 (midpoint 65)
  { age: 65, liftType: "Bench Press", gender: "female", bodyWeight: 57, physicallyActive: 9, beginner: 13, intermediate: 17, advanced: 38, elite: 38 },
  { age: 65, liftType: "Bench Press", gender: "female", bodyWeight: 68, physicallyActive: 18, beginner: 33, intermediate: 44, advanced: 40, elite: 53 },
  { age: 65, liftType: "Bench Press", gender: "female", bodyWeight: 79, physicallyActive: 20, beginner: 25, intermediate: 34, advanced: 46, elite: 61 },
  { age: 65, liftType: "Bench Press", gender: "female", bodyWeight: 91, physicallyActive: 22, beginner: 33, intermediate: 48, advanced: 66, elite: 62 },
  { age: 65, liftType: "Bench Press", gender: "female", bodyWeight: 102, physicallyActive: 12, beginner: 20, intermediate: 27, advanced: 37, elite: 65 },
  { age: 65, liftType: "Bench Press", gender: "female", bodyWeight: 113, physicallyActive: 18, beginner: 31, intermediate: 41, advanced: 56, elite: 69 },
  { age: 65, liftType: "Bench Press", gender: "female", bodyWeight: 136, physicallyActive: 20, beginner: 45, intermediate: 58, advanced: 65, elite: 70 },

  // Age 70-79 (midpoint 75)
  { age: 75, liftType: "Bench Press", gender: "female", bodyWeight: 57, physicallyActive: 9, beginner: 12, intermediate: 16, advanced: 21, elite: 28 },
  { age: 75, liftType: "Bench Press", gender: "female", bodyWeight: 68, physicallyActive: 14, beginner: 18, intermediate: 24, advanced: 32, elite: 43 },
  { age: 75, liftType: "Bench Press", gender: "female", bodyWeight: 79, physicallyActive: 16, beginner: 21, intermediate: 28, advanced: 37, elite: 49 },
  { age: 75, liftType: "Bench Press", gender: "female", bodyWeight: 91, physicallyActive: 17, beginner: 23, intermediate: 30, advanced: 40, elite: 54 },
  { age: 75, liftType: "Bench Press", gender: "female", bodyWeight: 102, physicallyActive: 17, beginner: 23, intermediate: 31, advanced: 41, elite: 55 },
  { age: 75, liftType: "Bench Press", gender: "female", bodyWeight: 113, physicallyActive: 18, beginner: 24, intermediate: 32, advanced: 42, elite: 56 },
  { age: 75, liftType: "Bench Press", gender: "female", bodyWeight: 136, physicallyActive: 19, beginner: 25, intermediate: 33, advanced: 44, elite: 59 },

  // Age 80-89 (midpoint 85)
  { age: 85, liftType: "Bench Press", gender: "female", bodyWeight: 57, physicallyActive: 8, beginner: 10, intermediate: 14, advanced: 18, elite: 24 },
  { age: 85, liftType: "Bench Press", gender: "female", bodyWeight: 68, physicallyActive: 9, beginner: 14, intermediate: 19, advanced: 25, elite: 34 },
  { age: 85, liftType: "Bench Press", gender: "female", bodyWeight: 79, physicallyActive: 12, beginner: 16, intermediate: 22, advanced: 29, elite: 39 },
  { age: 85, liftType: "Bench Press", gender: "female", bodyWeight: 91, physicallyActive: 13, beginner: 18, intermediate: 24, advanced: 32, elite: 43 },
  { age: 85, liftType: "Bench Press", gender: "female", bodyWeight: 102, physicallyActive: 14, beginner: 19, intermediate: 25, advanced: 33, elite: 44 },
  { age: 85, liftType: "Bench Press", gender: "female", bodyWeight: 113, physicallyActive: 15, beginner: 19, intermediate: 26, advanced: 34, elite: 46 },
  { age: 85, liftType: "Bench Press", gender: "female", bodyWeight: 136, physicallyActive: 15, beginner: 20, intermediate: 27, advanced: 36, elite: 48 },

  // Age 15-19 Deadlift Standards we mark as age 18 and interpolate
  { age: 18, liftType: "Deadlift", gender: "male", bodyWeight: 57, physicallyActive: 45, beginner: 74, intermediate: 93, advanced: 103, elite: 115 },
  { age: 18, liftType: "Deadlift", gender: "male", bodyWeight: 68, physicallyActive: 58, beginner: 97, intermediate: 121, advanced: 134, elite: 149 },
  { age: 18, liftType: "Deadlift", gender: "male", bodyWeight: 79, physicallyActive: 73, beginner: 122, intermediate: 152, advanced: 169, elite: 188 },
  { age: 18, liftType: "Deadlift", gender: "male", bodyWeight: 91, physicallyActive: 77, beginner: 129, intermediate: 161, advanced: 179, elite: 199 },
  { age: 18, liftType: "Deadlift", gender: "male", bodyWeight: 102, physicallyActive: 81, beginner: 135, intermediate: 169, advanced: 188, elite: 209 },
  { age: 18, liftType: "Deadlift", gender: "male", bodyWeight: 113, physicallyActive: 82, beginner: 137, intermediate: 172, advanced: 191, elite: 212 },
  { age: 18, liftType: "Deadlift", gender: "male", bodyWeight: 136, physicallyActive: 84, beginner: 139, intermediate: 174, advanced: 194, elite: 215 },
  // Age 80-89 Deadlift Standards we mark as age 85 and interpolate
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 57, physicallyActive: 21, beginner: 36, intermediate: 48, advanced: 60, elite: 68 },
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 68, physicallyActive: 25, beginner: 43, intermediate: 58, advanced: 72, elite: 85 },
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 79, physicallyActive: 30, beginner: 51, intermediate: 69, advanced: 86, elite: 101 },
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 91, physicallyActive: 32, beginner: 55, intermediate: 74, advanced: 92, elite: 108 },
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 102, physicallyActive: 35, beginner: 60, intermediate: 80, advanced: 100, elite: 118 },
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 113, physicallyActive: 35, beginner: 60, intermediate: 81, advanced: 101, elite: 119 },
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 136, physicallyActive: 36, beginner: 63, intermediate: 84, advanced: 105, elite: 123 },
];
