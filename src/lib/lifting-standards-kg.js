"use client";
// Data for lifting standards is based on the research of Professor Lon Kilgore
// https://lonkilgore.com/
// Use the kg data and convert to elsewhere when needed
// prettier-ignore
export const LiftingStandardsKG = [
  // Age 15-19 Squat Standards we mark as age 18 and interpolate
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 57, physicallyActive: 34, beginner: 59, intermediate: 78, advanced: 107, elite: 136, },
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 68, physicallyActive: 38, beginner: 65, intermediate: 87, advanced: 120, elite: 158, },
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 79, physicallyActive: 46, beginner: 80, intermediate: 106, advanced: 146, elite: 192, },
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 91, physicallyActive: 49, beginner: 85, intermediate: 113, advanced: 155, elite: 205, },
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 102, physicallyActive: 52, beginner: 89, intermediate: 118, advanced: 162, elite: 209, },
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 113, physicallyActive: 53, beginner: 90, intermediate: 120, advanced: 165, elite: 213, },
  { age: 18, liftType: "Squat", gender: "male", bodyWeight: 136, physicallyActive: 56, beginner: 97, intermediate: 129, advanced: 177, elite: 219, },
  // Age 80-89 Squat Standards we mark as age 85 and interpolate
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 57, physicallyActive: 18, beginner: 30, intermediate: 40, advanced: 55, elite: 73, },
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 68, physicallyActive: 24, beginner: 40, intermediate: 54, advanced: 74, elite: 97, },
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 79, physicallyActive: 26, beginner: 44, intermediate: 59, advanced: 81, elite: 107, },
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 91, physicallyActive: 27, beginner: 46, intermediate: 62, advanced: 85, elite: 112, },
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 102, physicallyActive: 28, beginner: 46, intermediate: 62, advanced: 86, elite: 113, },
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 113, physicallyActive: 28, beginner: 47, intermediate: 63, advanced: 87, elite: 115, },
  { age: 85, liftType: "Squat", gender: "male", bodyWeight: 136, physicallyActive: 28, beginner: 49, intermediate: 65, advanced: 89, elite: 117, },
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
