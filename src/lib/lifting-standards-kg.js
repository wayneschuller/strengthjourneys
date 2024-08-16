"use client";

import { devLog } from "./processing-utils";

// Data for lifting standards is based on the research of Professor Lon Kilgore
// https://lonkilgore.com/
// Use the kg data and convert to elsewhere when needed
// prettier-ignore
export const LiftingStandardsKG = [
  // Back Squat Male Section
  // Age 15-19 (midpoint 17)
  { age: 17, liftType: "Back Squat", gender: "male", bodyWeight: 57, physicallyActive: 34, beginner: 59, intermediate: 78, advanced: 107, elite: 136 },
  { age: 17, liftType: "Back Squat", gender: "male", bodyWeight: 68, physicallyActive: 38, beginner: 65, intermediate: 87, advanced: 120, elite: 158 },
  { age: 17, liftType: "Back Squat", gender: "male", bodyWeight: 79, physicallyActive: 46, beginner: 80, intermediate: 106, advanced: 146, elite: 192 },
  { age: 17, liftType: "Back Squat", gender: "male", bodyWeight: 91, physicallyActive: 49, beginner: 85, intermediate: 113, advanced: 155, elite: 205 },
  { age: 17, liftType: "Back Squat", gender: "male", bodyWeight: 102, physicallyActive: 52, beginner: 89, intermediate: 118, advanced: 162, elite: 209 },
  { age: 17, liftType: "Back Squat", gender: "male", bodyWeight: 113, physicallyActive: 53, beginner: 90, intermediate: 120, advanced: 165, elite: 213 },
  { age: 17, liftType: "Back Squat", gender: "male", bodyWeight: 136, physicallyActive: 56, beginner: 97, intermediate: 129, advanced: 177, elite: 219 },
  
  // Age 20-29 (midpoint 25)
  { age: 25, liftType: "Back Squat", gender: "male", bodyWeight: 57, physicallyActive: 38, beginner: 65, intermediate: 87, advanced: 120, elite: 153 },
  { age: 25, liftType: "Back Squat", gender: "male", bodyWeight: 68, physicallyActive: 46, beginner: 78, intermediate: 104, advanced: 143, elite: 189 },
  { age: 25, liftType: "Back Squat", gender: "male", bodyWeight: 79, physicallyActive: 51, beginner: 87, intermediate: 116, advanced: 160, elite: 210 },
  { age: 25, liftType: "Back Squat", gender: "male", bodyWeight: 91, physicallyActive: 58, beginner: 98, intermediate: 130, advanced: 179, elite: 236 },
  { age: 25, liftType: "Back Squat", gender: "male", bodyWeight: 102, physicallyActive: 57, beginner: 98, intermediate: 131, advanced: 180, elite: 232 },
  { age: 25, liftType: "Back Squat", gender: "male", bodyWeight: 113, physicallyActive: 70, beginner: 120, intermediate: 160, advanced: 220, elite: 285 },
  { age: 25, liftType: "Back Squat", gender: "male", bodyWeight: 136, physicallyActive: 68, beginner: 116, intermediate: 164, advanced: 226, elite: 282 },
  
  // Age 30-39 (midpoint 35)
  { age: 35, liftType: "Back Squat", gender: "male", bodyWeight: 57, physicallyActive: 40, beginner: 68, intermediate: 91, advanced: 125, elite: 159 },
  { age: 35, liftType: "Back Squat", gender: "male", bodyWeight: 68, physicallyActive: 48, beginner: 82, intermediate: 110, advanced: 151, elite: 199 },
  { age: 35, liftType: "Back Squat", gender: "male", bodyWeight: 79, physicallyActive: 53, beginner: 91, intermediate: 122, advanced: 167, elite: 220 },
  { age: 35, liftType: "Back Squat", gender: "male", bodyWeight: 91, physicallyActive: 58, beginner: 99, intermediate: 132, advanced: 181, elite: 238 },
  { age: 35, liftType: "Back Squat", gender: "male", bodyWeight: 102, physicallyActive: 62, beginner: 106, intermediate: 142, advanced: 195, elite: 252 },
  { age: 35, liftType: "Back Squat", gender: "male", bodyWeight: 113, physicallyActive: 66, beginner: 113, intermediate: 150, advanced: 206, elite: 267 },
  { age: 35, liftType: "Back Squat", gender: "male", bodyWeight: 136, physicallyActive: 74, beginner: 127, intermediate: 169, advanced: 232, elite: 291 },
  
  // Age 40-49 (midpoint 45)
  { age: 45, liftType: "Back Squat", gender: "male", bodyWeight: 57, physicallyActive: 38, beginner: 65, intermediate: 86, advanced: 118, elite: 142 },
  { age: 45, liftType: "Back Squat", gender: "male", bodyWeight: 68, physicallyActive: 43, beginner: 73, intermediate: 98, advanced: 134, elite: 161 },
  { age: 45, liftType: "Back Squat", gender: "male", bodyWeight: 79, physicallyActive: 46, beginner: 79, intermediate: 105, advanced: 144, elite: 173 },
  { age: 45, liftType: "Back Squat", gender: "male", bodyWeight: 91, physicallyActive: 54, beginner: 92, intermediate: 123, advanced: 169, elite: 203 },
  { age: 45, liftType: "Back Squat", gender: "male", bodyWeight: 102, physicallyActive: 56, beginner: 97, intermediate: 129, advanced: 177, elite: 213 },
  { age: 45, liftType: "Back Squat", gender: "male", bodyWeight: 113, physicallyActive: 61, beginner: 104, intermediate: 139, advanced: 191, elite: 229 },
  { age: 45, liftType: "Back Squat", gender: "male", bodyWeight: 136, physicallyActive: 66, beginner: 113, intermediate: 150, advanced: 206, elite: 248 },
  
  // Age 50-59 (midpoint 55)
  { age: 55, liftType: "Back Squat", gender: "male", bodyWeight: 57, physicallyActive: 32, beginner: 55, intermediate: 73, advanced: 100, elite: 132 },
  { age: 55, liftType: "Back Squat", gender: "male", bodyWeight: 68, physicallyActive: 37, beginner: 64, intermediate: 85, advanced: 117, elite: 154 },
  { age: 55, liftType: "Back Squat", gender: "male", bodyWeight: 79, physicallyActive: 42, beginner: 71, intermediate: 95, advanced: 131, elite: 172 },
  { age: 55, liftType: "Back Squat", gender: "male", bodyWeight: 91, physicallyActive: 46, beginner: 80, intermediate: 106, advanced: 146, elite: 192 },
  { age: 55, liftType: "Back Squat", gender: "male", bodyWeight: 102, physicallyActive: 50, beginner: 86, intermediate: 114, advanced: 157, elite: 207 },
  { age: 55, liftType: "Back Squat", gender: "male", bodyWeight: 113, physicallyActive: 53, beginner: 90, intermediate: 120, advanced: 165, elite: 218 },
  { age: 55, liftType: "Back Squat", gender: "male", bodyWeight: 136, physicallyActive: 54, beginner: 93, intermediate: 124, advanced: 171, elite: 225 },
  
  // Age 60-69 (midpoint 65)
  { age: 65, liftType: "Back Squat", gender: "male", bodyWeight: 57, physicallyActive: 23, beginner: 40, intermediate: 53, advanced: 73, elite: 96 },
  { age: 65, liftType: "Back Squat", gender: "male", bodyWeight: 68, physicallyActive: 33, beginner: 57, intermediate: 76, advanced: 105, elite: 138 },
  { age: 65, liftType: "Back Squat", gender: "male", bodyWeight: 79, physicallyActive: 40, beginner: 68, intermediate: 91, advanced: 125, elite: 165 },
  { age: 65, liftType: "Back Squat", gender: "male", bodyWeight: 91, physicallyActive: 43, beginner: 74, intermediate: 98, advanced: 135, elite: 178 },
  { age: 65, liftType: "Back Squat", gender: "male", bodyWeight: 102, physicallyActive: 47, beginner: 80, intermediate: 107, advanced: 147, elite: 194 },
  { age: 65, liftType: "Back Squat", gender: "male", bodyWeight: 113, physicallyActive: 48, beginner: 83, intermediate: 110, advanced: 151, elite: 199 },
  { age: 65, liftType: "Back Squat", gender: "male", bodyWeight: 136, physicallyActive: 50, beginner: 86, intermediate: 115, advanced: 158, elite: 208 },
  
  // Age 70-79 (midpoint 75)
  { age: 75, liftType: "Back Squat", gender: "male", bodyWeight: 57, physicallyActive: 22, beginner: 38, intermediate: 51, advanced: 70, elite: 92 },
  { age: 75, liftType: "Back Squat", gender: "male", bodyWeight: 68, physicallyActive: 30, beginner: 51, intermediate: 68, advanced: 94, elite: 123 },
  { age: 75, liftType: "Back Squat", gender: "male", bodyWeight: 79, physicallyActive: 33, beginner: 56, intermediate: 75, advanced: 103, elite: 136 },
  { age: 75, liftType: "Back Squat", gender: "male", bodyWeight: 91, physicallyActive: 34, beginner: 59, intermediate: 78, advanced: 107, elite: 141 },
  { age: 75, liftType: "Back Squat", gender: "male", bodyWeight: 102, physicallyActive: 35, beginner: 59, intermediate: 79, advanced: 109, elite: 143 },
  { age: 75, liftType: "Back Squat", gender: "male", bodyWeight: 113, physicallyActive: 35, beginner: 60, intermediate: 80, advanced: 110, elite: 145 },
  { age: 75, liftType: "Back Squat", gender: "male", bodyWeight: 136, physicallyActive: 36, beginner: 62, intermediate: 82, advanced: 113, elite: 149 },
  
  // Age 80-89 (midpoint 85)
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 57, physicallyActive: 18, beginner: 30, intermediate: 40, advanced: 55, elite: 73 },
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 68, physicallyActive: 24, beginner: 40, intermediate: 54, advanced: 74, elite: 97 },
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 79, physicallyActive: 26, beginner: 44, intermediate: 59, advanced: 81, elite: 107 },
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 91, physicallyActive: 27, beginner: 46, intermediate: 62, advanced: 85, elite: 112 },
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 102, physicallyActive: 28, beginner: 46, intermediate: 62, advanced: 86, elite: 113 },
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 113, physicallyActive: 28, beginner: 47, intermediate: 63, advanced: 87, elite: 115 },
  { age: 85, liftType: "Back Squat", gender: "male", bodyWeight: 136, physicallyActive: 28, beginner: 49, intermediate: 65, advanced: 89, elite: 117 },

  // Back Squat Female Section
  // Age 15-19 (midpoint 17)
  { age: 17, liftType: "Back Squat", gender: "female", bodyWeight: 57, physicallyActive: 23, beginner: 32, intermediate: 44, advanced: 61, elite: 84 },
  { age: 17, liftType: "Back Squat", gender: "female", bodyWeight: 68, physicallyActive: 29, beginner: 41, intermediate: 56, advanced: 77, elite: 106 },
  { age: 17, liftType: "Back Squat", gender: "female", bodyWeight: 79, physicallyActive: 32, beginner: 44, intermediate: 61, advanced: 84, elite: 116 },
  { age: 17, liftType: "Back Squat", gender: "female", bodyWeight: 91, physicallyActive: 35, beginner: 48, intermediate: 66, advanced: 91, elite: 126 },
  { age: 17, liftType: "Back Squat", gender: "female", bodyWeight: 102, physicallyActive: 35, beginner: 48, intermediate: 66, advanced: 91, elite: 125 },
  { age: 17, liftType: "Back Squat", gender: "female", bodyWeight: 113, physicallyActive: 36, beginner: 50, intermediate: 68, advanced: 94, elite: 130 },
  { age: 17, liftType: "Back Squat", gender: "female", bodyWeight: 136, physicallyActive: 53, beginner: 73, intermediate: 100, advanced: 138, elite: 190 },
  
    // Age 20-29 (midpoint 25)
    { age: 25, liftType: "Back Squat", gender: "female", bodyWeight: 57, physicallyActive: 27, beginner: 37, intermediate: 51, advanced: 70, elite: 97 },
    { age: 25, liftType: "Back Squat", gender: "female", bodyWeight: 68, physicallyActive: 32, beginner: 45, intermediate: 61, advanced: 85, elite: 118 },
    { age: 25, liftType: "Back Squat", gender: "female", bodyWeight: 79, physicallyActive: 35, beginner: 49, intermediate: 67, advanced: 93, elite: 128 },
    { age: 25, liftType: "Back Squat", gender: "female", bodyWeight: 91, physicallyActive: 36, beginner: 50, intermediate: 69, advanced: 95, elite: 132 },
    { age: 25, liftType: "Back Squat", gender: "female", bodyWeight: 102, physicallyActive: 40, beginner: 55, intermediate: 76, advanced: 105, elite: 145 },
    { age: 25, liftType: "Back Squat", gender: "female", bodyWeight: 113, physicallyActive: 46, beginner: 63, intermediate: 87, advanced: 120, elite: 165 },
    { age: 25, liftType: "Back Squat", gender: "female", bodyWeight: 136, physicallyActive: 57, beginner: 75, intermediate: 105, advanced: 140, elite: 195 },
  
    // Age 30-39 (midpoint 35)
    { age: 35, liftType: "Back Squat", gender: "female", bodyWeight: 57, physicallyActive: 28, beginner: 43, intermediate: 65, advanced: 89, elite: 112 },
    { age: 35, liftType: "Back Squat", gender: "female", bodyWeight: 68, physicallyActive: 34, beginner: 48, intermediate: 71, advanced: 97, elite: 128 },
    { age: 35, liftType: "Back Squat", gender: "female", bodyWeight: 79, physicallyActive: 36, beginner: 55, intermediate: 80, advanced: 110, elite: 144 },
    { age: 35, liftType: "Back Squat", gender: "female", bodyWeight: 91, physicallyActive: 38, beginner: 59, intermediate: 85, advanced: 117, elite: 154 },
    { age: 35, liftType: "Back Squat", gender: "female", bodyWeight: 102, physicallyActive: 44, beginner: 62, intermediate: 89, advanced: 123, elite: 157 },
    { age: 35, liftType: "Back Squat", gender: "female", bodyWeight: 113, physicallyActive: 51, beginner: 68, intermediate: 97, advanced: 134, elite: 171 },
    { age: 35, liftType: "Back Squat", gender: "female", bodyWeight: 136, physicallyActive: 60, beginner: 81, intermediate: 114, advanced: 157, elite: 192 },
  
    // Age 40-49 (midpoint 45)
    { age: 45, liftType: "Back Squat", gender: "female", bodyWeight: 57, physicallyActive: 23, beginner: 38, intermediate: 41, advanced: 69, elite: 78 },
    { age: 45, liftType: "Back Squat", gender: "female", bodyWeight: 68, physicallyActive: 30, beginner: 49, intermediate: 55, advanced: 90, elite: 100 },
    { age: 45, liftType: "Back Squat", gender: "female", bodyWeight: 79, physicallyActive: 33, beginner: 53, intermediate: 59, advanced: 96, elite: 108 },
    { age: 45, liftType: "Back Squat", gender: "female", bodyWeight: 91, physicallyActive: 34, beginner: 55, intermediate: 62, advanced: 101, elite: 114 },
    { age: 45, liftType: "Back Squat", gender: "female", bodyWeight: 102, physicallyActive: 36, beginner: 58, intermediate: 65, advanced: 105, elite: 119 },
    { age: 45, liftType: "Back Squat", gender: "female", bodyWeight: 113, physicallyActive: 38, beginner: 61, intermediate: 69, advanced: 111, elite: 126 },
    { age: 45, liftType: "Back Squat", gender: "female", bodyWeight: 136, physicallyActive: 40, beginner: 64, intermediate: 73, advanced: 117, elite: 133 },
  
    // Age 50-59 (midpoint 55)
    { age: 55, liftType: "Back Squat", gender: "female", bodyWeight: 57, physicallyActive: 19, beginner: 33, intermediate: 40, advanced: 60, elite: 76 },
    { age: 55, liftType: "Back Squat", gender: "female", bodyWeight: 68, physicallyActive: 24, beginner: 41, intermediate: 54, advanced: 74, elite: 97 },
    { age: 55, liftType: "Back Squat", gender: "female", bodyWeight: 79, physicallyActive: 25, beginner: 42, intermediate: 56, advanced: 76, elite: 102 },
    { age: 55, liftType: "Back Squat", gender: "female", bodyWeight: 91, physicallyActive: 26, beginner: 44, intermediate: 59, advanced: 81, elite: 107 },
    { age: 55, liftType: "Back Squat", gender: "female", bodyWeight: 102, physicallyActive: 29, beginner: 49, intermediate: 64, advanced: 90, elite: 118 },
    { age: 55, liftType: "Back Squat", gender: "female", bodyWeight: 113, physicallyActive: 29, beginner: 50, intermediate: 67, advanced: 92, elite: 121 },
    { age: 55, liftType: "Back Squat", gender: "female", bodyWeight: 136, physicallyActive: 35, beginner: 59, intermediate: 70, advanced: 111, elite: 130 },
  
    // Age 60-69 (midpoint 65)
    { age: 65, liftType: "Back Squat", gender: "female", bodyWeight: 57, physicallyActive: 15, beginner: 26, intermediate: 35, advanced: 48, elite: 63 },
    { age: 65, liftType: "Back Squat", gender: "female", bodyWeight: 68, physicallyActive: 18, beginner: 33, intermediate: 44, advanced: 62, elite: 81 },
    { age: 65, liftType: "Back Squat", gender: "female", bodyWeight: 79, physicallyActive: 20, beginner: 35, intermediate: 47, advanced: 65, elite: 83 },
    { age: 65, liftType: "Back Squat", gender: "female", bodyWeight: 91, physicallyActive: 22, beginner: 37, intermediate: 48, advanced: 66, elite: 85 },
    { age: 65, liftType: "Back Squat", gender: "female", bodyWeight: 102, physicallyActive: 24, beginner: 40, intermediate: 54, advanced: 74, elite: 93 },
    { age: 65, liftType: "Back Squat", gender: "female", bodyWeight: 113, physicallyActive: 25, beginner: 42, intermediate: 56, advanced: 78, elite: 99 },
    { age: 65, liftType: "Back Squat", gender: "female", bodyWeight: 136, physicallyActive: 26, beginner: 45, intermediate: 58, advanced: 79, elite: 102 },
  
    // Age 70-79 (midpoint 75)
    { age: 75, liftType: "Back Squat", gender: "female", bodyWeight: 57, physicallyActive: 14, beginner: 24, intermediate: 32, advanced: 44, elite: 58 },
    { age: 75, liftType: "Back Squat", gender: "female", bodyWeight: 68, physicallyActive: 15, beginner: 25, intermediate: 33, advanced: 46, elite: 60 },
    { age: 75, liftType: "Back Squat", gender: "female", bodyWeight: 79, physicallyActive: 16, beginner: 27, intermediate: 36, advanced: 50, elite: 65 },
    { age: 75, liftType: "Back Squat", gender: "female", bodyWeight: 91, physicallyActive: 17, beginner: 28, intermediate: 37, advanced: 52, elite: 69 },
    { age: 75, liftType: "Back Squat", gender: "female", bodyWeight: 102, physicallyActive: 17, beginner: 29, intermediate: 39, advanced: 54, elite: 71 },
    { age: 75, liftType: "Back Squat", gender: "female", bodyWeight: 113, physicallyActive: 18, beginner: 30, intermediate: 40, advanced: 55, elite: 73 },
    { age: 75, liftType: "Back Squat", gender: "female", bodyWeight: 136, physicallyActive: 18, beginner: 30, intermediate: 40, advanced: 55, elite: 73 },
  
    // Age 80-89 (midpoint 85)
    { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 57, physicallyActive: 11, beginner: 19, intermediate: 25, advanced: 35, elite: 46 },
    { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 68, physicallyActive: 11, beginner: 20, intermediate: 26, advanced: 36, elite: 48 },
    { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 79, physicallyActive: 12, beginner: 21, intermediate: 28, advanced: 39, elite: 52 },
    { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 91, physicallyActive: 13, beginner: 23, intermediate: 30, advanced: 41, elite: 54 },
    { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 102, physicallyActive: 13, beginner: 23, intermediate: 31, advanced: 42, elite: 56 },
    { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 113, physicallyActive: 14, beginner: 24, intermediate: 32, advanced: 43, elite: 57 },
    { age: 85, liftType: "Back Squat", gender: "female", bodyWeight: 136, physicallyActive: 14, beginner: 24, intermediate: 32, advanced: 43, elite: 57 },


  // Bench Press Male Section
  // Age 15-19 (midpoint 17)
  { age: 17, liftType: "Bench Press", gender: "male", bodyWeight: 57, physicallyActive: 34, beginner: 47, intermediate: 61, advanced: 74, elite: 85 },
  { age: 17, liftType: "Bench Press", gender: "male", bodyWeight: 68, physicallyActive: 42, beginner: 59, intermediate: 76, advanced: 92, elite: 107 },
  { age: 17, liftType: "Bench Press", gender: "male", bodyWeight: 79, physicallyActive: 43, beginner: 60, intermediate: 77, advanced: 94, elite: 110 },
  { age: 17, liftType: "Bench Press", gender: "male", bodyWeight: 91, physicallyActive: 51, beginner: 71, intermediate: 91, advanced: 111, elite: 132 },
  { age: 17, liftType: "Bench Press", gender: "male", bodyWeight: 102, physicallyActive: 53, beginner: 74, intermediate: 95, advanced: 116, elite: 134 },
  { age: 17, liftType: "Bench Press", gender: "male", bodyWeight: 113, physicallyActive: 53, beginner: 74, intermediate: 96, advanced: 117, elite: 137 },
  { age: 17, liftType: "Bench Press", gender: "male", bodyWeight: 136, physicallyActive: 53, beginner: 74, intermediate: 95, advanced: 116, elite: 138 },

  // Age 20-29 (midpoint 25)
  { age: 25, liftType: "Bench Press", gender: "male", bodyWeight: 57, physicallyActive: 36, beginner: 51, intermediate: 65, advanced: 80, elite: 92 },
  { age: 25, liftType: "Bench Press", gender: "male", bodyWeight: 68, physicallyActive: 50, beginner: 70, intermediate: 90, advanced: 110, elite: 130 },
  { age: 25, liftType: "Bench Press", gender: "male", bodyWeight: 79, physicallyActive: 50, beginner: 70, intermediate: 90, advanced: 110, elite: 150 },
  { age: 25, liftType: "Bench Press", gender: "male", bodyWeight: 91, physicallyActive: 52, beginner: 73, intermediate: 93, advanced: 114, elite: 161 },
  { age: 25, liftType: "Bench Press", gender: "male", bodyWeight: 102, physicallyActive: 55, beginner: 77, intermediate: 99, advanced: 121, elite: 170 },
  { age: 25, liftType: "Bench Press", gender: "male", bodyWeight: 113, physicallyActive: 59, beginner: 82, intermediate: 106, advanced: 129, elite: 181 },
  { age: 25, liftType: "Bench Press", gender: "male", bodyWeight: 136, physicallyActive: 61, beginner: 85, intermediate: 109, advanced: 133, elite: 182 },

  // Age 30-39 (midpoint 35)
  { age: 35, liftType: "Bench Press", gender: "male", bodyWeight: 57, physicallyActive: 39, beginner: 55, intermediate: 71, advanced: 87, elite: 114 },
  { age: 35, liftType: "Bench Press", gender: "male", bodyWeight: 68, physicallyActive: 53, beginner: 75, intermediate: 96, advanced: 117, elite: 155 },
  { age: 35, liftType: "Bench Press", gender: "male", bodyWeight: 79, physicallyActive: 54, beginner: 75, intermediate: 97, advanced: 119, elite: 156 },
  { age: 35, liftType: "Bench Press", gender: "male", bodyWeight: 91, physicallyActive: 59, beginner: 83, intermediate: 107, advanced: 131, elite: 173 },
  { age: 35, liftType: "Bench Press", gender: "male", bodyWeight: 102, physicallyActive: 61, beginner: 84, intermediate: 108, advanced: 135, elite: 176 },
  { age: 35, liftType: "Bench Press", gender: "male", bodyWeight: 113, physicallyActive: 62, beginner: 85, intermediate: 110, advanced: 139, elite: 177 },
  { age: 35, liftType: "Bench Press", gender: "male", bodyWeight: 136, physicallyActive: 67, beginner: 94, intermediate: 121, advanced: 148, elite: 195 },

  // Age 40-49 (midpoint 45)
  { age: 45, liftType: "Bench Press", gender: "male", bodyWeight: 57, physicallyActive: 37, beginner: 52, intermediate: 66, advanced: 81, elite: 105 },
  { age: 45, liftType: "Bench Press", gender: "male", bodyWeight: 68, physicallyActive: 41, beginner: 57, intermediate: 73, advanced: 89, elite: 116 },
  { age: 45, liftType: "Bench Press", gender: "male", bodyWeight: 79, physicallyActive: 48, beginner: 67, intermediate: 86, advanced: 105, elite: 135 },
  { age: 45, liftType: "Bench Press", gender: "male", bodyWeight: 91, physicallyActive: 54, beginner: 75, intermediate: 97, advanced: 118, elite: 143 },
  { age: 45, liftType: "Bench Press", gender: "male", bodyWeight: 102, physicallyActive: 56, beginner: 78, intermediate: 100, advanced: 122, elite: 154 },
  { age: 45, liftType: "Bench Press", gender: "male", bodyWeight: 113, physicallyActive: 58, beginner: 81, intermediate: 104, advanced: 127, elite: 164 },
  { age: 45, liftType: "Bench Press", gender: "male", bodyWeight: 136, physicallyActive: 62, beginner: 87, intermediate: 111, advanced: 136, elite: 166 },

  // Age 50-59 (midpoint 55)
  { age: 55, liftType: "Bench Press", gender: "male", bodyWeight: 57, physicallyActive: 29, beginner: 41, intermediate: 53, advanced: 65, elite: 74 },
  { age: 55, liftType: "Bench Press", gender: "male", bodyWeight: 68, physicallyActive: 40, beginner: 56, intermediate: 72, advanced: 88, elite: 104 },
  { age: 55, liftType: "Bench Press", gender: "male", bodyWeight: 79, physicallyActive: 43, beginner: 60, intermediate: 77, advanced: 94, elite: 111 },
  { age: 55, liftType: "Bench Press", gender: "male", bodyWeight: 91, physicallyActive: 49, beginner: 68, intermediate: 88, advanced: 107, elite: 129 },
  { age: 55, liftType: "Bench Press", gender: "male", bodyWeight: 102, physicallyActive: 53, beginner: 74, intermediate: 95, advanced: 116, elite: 140 },
  { age: 55, liftType: "Bench Press", gender: "male", bodyWeight: 113, physicallyActive: 54, beginner: 75, intermediate: 97, advanced: 118, elite: 143 },
  { age: 55, liftType: "Bench Press", gender: "male", bodyWeight: 136, physicallyActive: 54, beginner: 76, intermediate: 98, advanced: 120, elite: 145 },

  // Age 60-69 (midpoint 65)
  { age: 65, liftType: "Bench Press", gender: "male", bodyWeight: 57, physicallyActive: 25, beginner: 35, intermediate: 45, advanced: 55, elite: 68 },
  { age: 65, liftType: "Bench Press", gender: "male", bodyWeight: 68, physicallyActive: 32, beginner: 45, intermediate: 57, advanced: 70, elite: 88 },
  { age: 65, liftType: "Bench Press", gender: "male", bodyWeight: 79, physicallyActive: 36, beginner: 50, intermediate: 64, advanced: 78, elite: 99 },
  { age: 65, liftType: "Bench Press", gender: "male", bodyWeight: 91, physicallyActive: 47, beginner: 66, intermediate: 84, advanced: 103, elite: 131 },
  { age: 65, liftType: "Bench Press", gender: "male", bodyWeight: 102, physicallyActive: 48, beginner: 67, intermediate: 87, advanced: 106, elite: 134 },
  { age: 65, liftType: "Bench Press", gender: "male", bodyWeight: 113, physicallyActive: 49, beginner: 68, intermediate: 88, advanced: 107, elite: 136 },
  { age: 65, liftType: "Bench Press", gender: "male", bodyWeight: 136, physicallyActive: 50, beginner: 69, intermediate: 89, advanced: 109, elite: 138 },

  // Age 70-79 (midpoint 75)
  { age: 75, liftType: "Bench Press", gender: "male", bodyWeight: 57, physicallyActive: 23, beginner: 32, intermediate: 41, advanced: 50, elite: 60 },
  { age: 75, liftType: "Bench Press", gender: "male", bodyWeight: 68, physicallyActive: 29, beginner: 40, intermediate: 52, advanced: 63, elite: 78 },
  { age: 75, liftType: "Bench Press", gender: "male", bodyWeight: 79, physicallyActive: 33, beginner: 46, intermediate: 59, advanced: 72, elite: 89 },
  { age: 75, liftType: "Bench Press", gender: "male", bodyWeight: 91, physicallyActive: 34, beginner: 48, intermediate: 62, advanced: 76, elite: 94 },
  { age: 75, liftType: "Bench Press", gender: "male", bodyWeight: 102, physicallyActive: 36, beginner: 51, intermediate: 65, advanced: 80, elite: 99 },
  { age: 75, liftType: "Bench Press", gender: "male", bodyWeight: 113, physicallyActive: 44, beginner: 61, intermediate: 79, advanced: 96, elite: 121 },
  { age: 75, liftType: "Bench Press", gender: "male", bodyWeight: 136, physicallyActive: 48, beginner: 67, intermediate: 86, advanced: 105, elite: 131 },

  // Age 80-89 (midpoint 85)
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 57, physicallyActive: 16, beginner: 22, intermediate: 28, advanced: 34, elite: 41 },
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 68, physicallyActive: 20, beginner: 28, intermediate: 36, advanced: 44, elite: 54 },
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 79, physicallyActive: 22, beginner: 31, intermediate: 40, advanced: 49, elite: 61 },
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 91, physicallyActive: 24, beginner: 33, intermediate: 43, advanced: 52, elite: 65 },
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 102, physicallyActive: 25, beginner: 35, intermediate: 45, advanced: 55, elite: 69 },
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 113, physicallyActive: 30, beginner: 42, intermediate: 54, advanced: 66, elite: 83 },
  { age: 85, liftType: "Bench Press", gender: "male", bodyWeight: 136, physicallyActive: 33, beginner: 46, intermediate: 59, advanced: 72, elite: 91 },
 
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

  // Deadlift Male Section
  // Age 15-19 (midpoint 17)
  { age: 17, liftType: "Deadlift", gender: "male", bodyWeight: 57, physicallyActive: 45, beginner: 74, intermediate: 93, advanced: 103, elite: 115 },
  { age: 17, liftType: "Deadlift", gender: "male", bodyWeight: 68, physicallyActive: 58, beginner: 97, intermediate: 121, advanced: 134, elite: 149 },
  { age: 17, liftType: "Deadlift", gender: "male", bodyWeight: 79, physicallyActive: 73, beginner: 122, intermediate: 152, advanced: 169, elite: 188 },
  { age: 17, liftType: "Deadlift", gender: "male", bodyWeight: 91, physicallyActive: 77, beginner: 129, intermediate: 161, advanced: 179, elite: 199 },
  { age: 17, liftType: "Deadlift", gender: "male", bodyWeight: 102, physicallyActive: 81, beginner: 135, intermediate: 169, advanced: 188, elite: 209 },
  { age: 17, liftType: "Deadlift", gender: "male", bodyWeight: 113, physicallyActive: 82, beginner: 137, intermediate: 172, advanced: 191, elite: 212 },
  { age: 17, liftType: "Deadlift", gender: "male", bodyWeight: 136, physicallyActive: 84, beginner: 139, intermediate: 174, advanced: 194, elite: 215 },

  // Age 20-29 (midpoint 25)
  { age: 25, liftType: "Deadlift", gender: "male", bodyWeight: 57, physicallyActive: 47, beginner: 81, intermediate: 101, advanced: 127, elite: 141 },
  { age: 25, liftType: "Deadlift", gender: "male", bodyWeight: 68, physicallyActive: 64, beginner: 112, intermediate: 139, advanced: 186, elite: 207 },
  { age: 25, liftType: "Deadlift", gender: "male", bodyWeight: 79, physicallyActive: 76, beginner: 131, intermediate: 164, advanced: 219, elite: 243 },
  { age: 25, liftType: "Deadlift", gender: "male", bodyWeight: 91, physicallyActive: 83, beginner: 144, intermediate: 180, advanced: 240, elite: 266 },
  { age: 25, liftType: "Deadlift", gender: "male", bodyWeight: 102, physicallyActive: 84, beginner: 146, intermediate: 182, advanced: 243, elite: 270 },
  { age: 25, liftType: "Deadlift", gender: "male", bodyWeight: 113, physicallyActive: 85, beginner: 147, intermediate: 184, advanced: 245, elite: 273 },
  { age: 25, liftType: "Deadlift", gender: "male", bodyWeight: 136, physicallyActive: 86, beginner: 149, intermediate: 187, advanced: 249, elite: 276 },

  // Age 30-39 (midpoint 35)
  { age: 35, liftType: "Deadlift", gender: "male", bodyWeight: 57, physicallyActive: 51, beginner: 89, intermediate: 112, advanced: 149, elite: 175 },
  { age: 35, liftType: "Deadlift", gender: "male", bodyWeight: 68, physicallyActive: 64, beginner: 112, intermediate: 140, advanced: 186, elite: 219 },
  { age: 35, liftType: "Deadlift", gender: "male", bodyWeight: 79, physicallyActive: 76, beginner: 132, intermediate: 165, advanced: 220, elite: 259 },
  { age: 35, liftType: "Deadlift", gender: "male", bodyWeight: 91, physicallyActive: 81, beginner: 142, intermediate: 177, advanced: 236, elite: 278 },
  { age: 35, liftType: "Deadlift", gender: "male", bodyWeight: 102, physicallyActive: 83, beginner: 145, intermediate: 181, advanced: 242, elite: 284 },
  { age: 35, liftType: "Deadlift", gender: "male", bodyWeight: 113, physicallyActive: 84, beginner: 146, intermediate: 183, advanced: 244, elite: 287 },
  { age: 35, liftType: "Deadlift", gender: "male", bodyWeight: 136, physicallyActive: 89, beginner: 154, intermediate: 192, advanced: 257, elite: 302 },

  // Age 40-49 (midpoint 45)
  { age: 45, liftType: "Deadlift", gender: "male", bodyWeight: 57, physicallyActive: 46, beginner: 80, intermediate: 100, advanced: 118, elite: 131 },
  { age: 45, liftType: "Deadlift", gender: "male", bodyWeight: 68, physicallyActive: 53, beginner: 92, intermediate: 115, advanced: 154, elite: 181 },
  { age: 45, liftType: "Deadlift", gender: "male", bodyWeight: 79, physicallyActive: 63, beginner: 109, intermediate: 137, advanced: 182, elite: 214 },
  { age: 45, liftType: "Deadlift", gender: "male", bodyWeight: 91, physicallyActive: 65, beginner: 113, intermediate: 141, advanced: 188, elite: 222 },
  { age: 45, liftType: "Deadlift", gender: "male", bodyWeight: 102, physicallyActive: 71, beginner: 124, intermediate: 154, advanced: 206, elite: 242 },
  { age: 45, liftType: "Deadlift", gender: "male", bodyWeight: 113, physicallyActive: 75, beginner: 130, intermediate: 162, advanced: 217, elite: 255 },
  { age: 45, liftType: "Deadlift", gender: "male", bodyWeight: 136, physicallyActive: 76, beginner: 133, intermediate: 166, advanced: 221, elite: 260 },

  // Age 50-59 (midpoint 55)
  { age: 55, liftType: "Deadlift", gender: "male", bodyWeight: 57, physicallyActive: 40, beginner: 69, intermediate: 86, advanced: 102, elite: 113 },
  { age: 55, liftType: "Deadlift", gender: "male", bodyWeight: 68, physicallyActive: 48, beginner: 84, intermediate: 105, advanced: 140, elite: 164 },
  { age: 55, liftType: "Deadlift", gender: "male", bodyWeight: 79, physicallyActive: 56, beginner: 97, intermediate: 121, advanced: 161, elite: 190 },
  { age: 55, liftType: "Deadlift", gender: "male", bodyWeight: 91, physicallyActive: 60, beginner: 104, intermediate: 130, advanced: 173, elite: 204 },
  { age: 55, liftType: "Deadlift", gender: "male", bodyWeight: 102, physicallyActive: 63, beginner: 110, intermediate: 138, advanced: 183, elite: 216 },
  { age: 55, liftType: "Deadlift", gender: "male", bodyWeight: 113, physicallyActive: 64, beginner: 111, intermediate: 139, advanced: 185, elite: 218 },
  { age: 55, liftType: "Deadlift", gender: "male", bodyWeight: 136, physicallyActive: 65, beginner: 114, intermediate: 142, advanced: 190, elite: 223 },

  // Age 60-69 (midpoint 65)
  { age: 65, liftType: "Deadlift", gender: "male", bodyWeight: 57, physicallyActive: 35, beginner: 61, intermediate: 79, advanced: 95, elite: 109 },
  { age: 65, liftType: "Deadlift", gender: "male", bodyWeight: 68, physicallyActive: 46, beginner: 79, intermediate: 103, advanced: 124, elite: 142 },
  { age: 65, liftType: "Deadlift", gender: "male", bodyWeight: 79, physicallyActive: 52, beginner: 90, intermediate: 117, advanced: 141, elite: 162 },
  { age: 65, liftType: "Deadlift", gender: "male", bodyWeight: 91, physicallyActive: 57, beginner: 98, intermediate: 128, advanced: 155, elite: 177 },
  { age: 65, liftType: "Deadlift", gender: "male", bodyWeight: 102, physicallyActive: 61, beginner: 107, intermediate: 138, advanced: 167, elite: 191 },
  { age: 65, liftType: "Deadlift", gender: "male", bodyWeight: 113, physicallyActive: 62, beginner: 109, intermediate: 140, advanced: 170, elite: 194 },
  { age: 65, liftType: "Deadlift", gender: "male", bodyWeight: 136, physicallyActive: 64, beginner: 112, intermediate: 144, advanced: 175, elite: 200 },

  // Age 70-79 (midpoint 75)
  { age: 75, liftType: "Deadlift", gender: "male", bodyWeight: 57, physicallyActive: 29, beginner: 51, intermediate: 68, advanced: 85, elite: 98 },
  { age: 75, liftType: "Deadlift", gender: "male", bodyWeight: 68, physicallyActive: 36, beginner: 62, intermediate: 82, advanced: 103, elite: 121 },
  { age: 75, liftType: "Deadlift", gender: "male", bodyWeight: 79, physicallyActive: 42, beginner: 74, intermediate: 98, advanced: 123, elite: 144 },
  { age: 75, liftType: "Deadlift", gender: "male", bodyWeight: 91, physicallyActive: 45, beginner: 79, intermediate: 105, advanced: 131, elite: 155 },
  { age: 75, liftType: "Deadlift", gender: "male", bodyWeight: 102, physicallyActive: 49, beginner: 86, intermediate: 114, advanced: 143, elite: 168 },
  { age: 75, liftType: "Deadlift", gender: "male", bodyWeight: 113, physicallyActive: 50, beginner: 87, intermediate: 116, advanced: 145, elite: 170 },
  { age: 75, liftType: "Deadlift", gender: "male", bodyWeight: 136, physicallyActive: 52, beginner: 90, intermediate: 120, advanced: 150, elite: 176 },

  // Age 80-89 (midpoint 85)
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 57, physicallyActive: 21, beginner: 36, intermediate: 48, advanced: 60, elite: 68 },
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 68, physicallyActive: 25, beginner: 43, intermediate: 58, advanced: 72, elite: 85 },
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 79, physicallyActive: 30, beginner: 51, intermediate: 69, advanced: 86, elite: 101 },
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 91, physicallyActive: 32, beginner: 55, intermediate: 74, advanced: 92, elite: 108 },
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 102, physicallyActive: 35, beginner: 60, intermediate: 80, advanced: 100, elite: 118 },
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 113, physicallyActive: 35, beginner: 61, intermediate: 81, advanced: 101, elite: 119 },
  { age: 85, liftType: "Deadlift", gender: "male", bodyWeight: 136, physicallyActive: 36, beginner: 63, intermediate: 84, advanced: 105, elite: 123 },

  // Deadlift Female Section
  // Age 15-19 (midpoint 17)
  { age: 17, liftType: "Deadlift", gender: "female", bodyWeight: 57, physicallyActive: 17, beginner: 39, intermediate: 51, advanced: 62, elite: 82 },
  { age: 17, liftType: "Deadlift", gender: "female", bodyWeight: 68, physicallyActive: 22, beginner: 51, intermediate: 65, advanced: 80, elite: 102 },
  { age: 17, liftType: "Deadlift", gender: "female", bodyWeight: 79, physicallyActive: 24, beginner: 56, intermediate: 72, advanced: 88, elite: 108 },
  { age: 17, liftType: "Deadlift", gender: "female", bodyWeight: 91, physicallyActive: 25, beginner: 59, intermediate: 75, advanced: 92, elite: 113 },
  { age: 17, liftType: "Deadlift", gender: "female", bodyWeight: 102, physicallyActive: 26, beginner: 61, intermediate: 79, advanced: 99, elite: 118 },
  { age: 17, liftType: "Deadlift", gender: "female", bodyWeight: 113, physicallyActive: 27, beginner: 62, intermediate: 80, advanced: 103, elite: 123 },
  { age: 17, liftType: "Deadlift", gender: "female", bodyWeight: 136, physicallyActive: 29, beginner: 69, intermediate: 89, advanced: 109, elite: 129 },
  
  // Age 20-29 (midpoint 25)
  { age: 25, liftType: "Deadlift", gender: "female", bodyWeight: 57, physicallyActive: 25, beginner: 58, intermediate: 74, advanced: 91, elite: 120 },
  { age: 25, liftType: "Deadlift", gender: "female", bodyWeight: 68, physicallyActive: 30, beginner: 70, intermediate: 90, advanced: 110, elite: 140 },
  { age: 25, liftType: "Deadlift", gender: "female", bodyWeight: 79, physicallyActive: 33, beginner: 77, intermediate: 99, advanced: 121, elite: 150 },
  { age: 25, liftType: "Deadlift", gender: "female", bodyWeight: 91, physicallyActive: 34, beginner: 79, intermediate: 101, advanced: 124, elite: 154 },
  { age: 25, liftType: "Deadlift", gender: "female", bodyWeight: 102, physicallyActive: 35, beginner: 82, intermediate: 107, advanced: 133, elite: 162 },
  { age: 25, liftType: "Deadlift", gender: "female", bodyWeight: 113, physicallyActive: 35, beginner: 82, intermediate: 106, advanced: 134, elite: 164 },
  { age: 25, liftType: "Deadlift", gender: "female", bodyWeight: 136, physicallyActive: 36, beginner: 84, intermediate: 108, advanced: 132, elite: 159 },
  
    // Age 30-39 (midpoint 35)
    { age: 35, liftType: "Deadlift", gender: "female", bodyWeight: 57, physicallyActive: 30, beginner: 70, intermediate: 90, advanced: 110, elite: 145 },
    { age: 35, liftType: "Deadlift", gender: "female", bodyWeight: 68, physicallyActive: 32, beginner: 74, intermediate: 96, advanced: 117, elite: 149 },
    { age: 35, liftType: "Deadlift", gender: "female", bodyWeight: 79, physicallyActive: 35, beginner: 81, intermediate: 104, advanced: 127, elite: 157 },
    { age: 35, liftType: "Deadlift", gender: "female", bodyWeight: 91, physicallyActive: 36, beginner: 83, intermediate: 107, advanced: 131, elite: 162 },
    { age: 35, liftType: "Deadlift", gender: "female", bodyWeight: 102, physicallyActive: 39, beginner: 91, intermediate: 118, advanced: 147, elite: 179 },
    { age: 35, liftType: "Deadlift", gender: "female", bodyWeight: 113, physicallyActive: 40, beginner: 93, intermediate: 119, advanced: 151, elite: 185 },
    { age: 35, liftType: "Deadlift", gender: "female", bodyWeight: 136, physicallyActive: 40, beginner: 94, intermediate: 120, advanced: 147, elite: 178 },
  
    // Age 40-49 (midpoint 45)
    { age: 45, liftType: "Deadlift", gender: "female", bodyWeight: 57, physicallyActive: 23, beginner: 54, intermediate: 70, advanced: 85, elite: 112 },
    { age: 45, liftType: "Deadlift", gender: "female", bodyWeight: 68, physicallyActive: 29, beginner: 67, intermediate: 86, advanced: 105, elite: 133 },
    { age: 45, liftType: "Deadlift", gender: "female", bodyWeight: 79, physicallyActive: 30, beginner: 69, intermediate: 89, advanced: 109, elite: 134 },
    { age: 45, liftType: "Deadlift", gender: "female", bodyWeight: 91, physicallyActive: 32, beginner: 74, intermediate: 95, advanced: 116, elite: 143 },
    { age: 45, liftType: "Deadlift", gender: "female", bodyWeight: 102, physicallyActive: 33, beginner: 78, intermediate: 101, advanced: 126, elite: 153 },
    { age: 45, liftType: "Deadlift", gender: "female", bodyWeight: 113, physicallyActive: 35, beginner: 81, intermediate: 104, advanced: 132, elite: 160 },
    { age: 45, liftType: "Deadlift", gender: "female", bodyWeight: 136, physicallyActive: 35, beginner: 82, intermediate: 106, advanced: 129, elite: 156 },
  
    // Age 50-59 (midpoint 55)
    { age: 55, liftType: "Deadlift", gender: "female", bodyWeight: 57, physicallyActive: 22, beginner: 51, intermediate: 65, advanced: 80, elite: 105 },
    { age: 55, liftType: "Deadlift", gender: "female", bodyWeight: 68, physicallyActive: 24, beginner: 57, intermediate: 73, advanced: 89, elite: 114 },
    { age: 55, liftType: "Deadlift", gender: "female", bodyWeight: 79, physicallyActive: 26, beginner: 60, intermediate: 78, advanced: 95, elite: 117 },
    { age: 55, liftType: "Deadlift", gender: "female", bodyWeight: 91, physicallyActive: 28, beginner: 65, intermediate: 83, advanced: 102, elite: 126 },
    { age: 55, liftType: "Deadlift", gender: "female", bodyWeight: 102, physicallyActive: 29, beginner: 69, intermediate: 90, advanced: 112, elite: 136 },
    { age: 55, liftType: "Deadlift", gender: "female", bodyWeight: 113, physicallyActive: 30, beginner: 69, intermediate: 89, advanced: 114, elite: 137 },
    { age: 55, liftType: "Deadlift", gender: "female", bodyWeight: 136, physicallyActive: 31, beginner: 72, intermediate: 92, advanced: 113, elite: 135 },
  
    // Age 60-69 (midpoint 65)
    { age: 65, liftType: "Deadlift", gender: "female", bodyWeight: 57, physicallyActive: 18, beginner: 43, intermediate: 55, advanced: 67, elite: 89 },
    { age: 65, liftType: "Deadlift", gender: "female", bodyWeight: 68, physicallyActive: 23, beginner: 53, intermediate: 69, advanced: 84, elite: 107 },
    { age: 65, liftType: "Deadlift", gender: "female", bodyWeight: 79, physicallyActive: 24, beginner: 56, intermediate: 72, advanced: 89, elite: 109 },
    { age: 65, liftType: "Deadlift", gender: "female", bodyWeight: 91, physicallyActive: 25, beginner: 58, intermediate: 74, advanced: 91, elite: 112 },
    { age: 65, liftType: "Deadlift", gender: "female", bodyWeight: 102, physicallyActive: 25, beginner: 60, intermediate: 77, advanced: 97, elite: 116 },
    { age: 65, liftType: "Deadlift", gender: "female", bodyWeight: 113, physicallyActive: 26, beginner: 60, intermediate: 77, advanced: 99, elite: 118 },
    { age: 65, liftType: "Deadlift", gender: "female", bodyWeight: 136, physicallyActive: 26, beginner: 60, intermediate: 78, advanced: 95, elite: 112 },
  
    // Age 70-79 (midpoint 75)
    { age: 75, liftType: "Deadlift", gender: "female", bodyWeight: 57, physicallyActive: 18, beginner: 42, intermediate: 53, advanced: 66, elite: 84 },
    { age: 75, liftType: "Deadlift", gender: "female", bodyWeight: 68, physicallyActive: 18, beginner: 43, intermediate: 55, advanced: 67, elite: 86 },
    { age: 75, liftType: "Deadlift", gender: "female", bodyWeight: 79, physicallyActive: 20, beginner: 46, intermediate: 59, advanced: 72, elite: 92 },
    { age: 75, liftType: "Deadlift", gender: "female", bodyWeight: 91, physicallyActive: 20, beginner: 47, intermediate: 60, advanced: 73, elite: 93 },
    { age: 75, liftType: "Deadlift", gender: "female", bodyWeight: 102, physicallyActive: 20, beginner: 47, intermediate: 61, advanced: 79, elite: 94 },
    { age: 75, liftType: "Deadlift", gender: "female", bodyWeight: 113, physicallyActive: 20, beginner: 47, intermediate: 61, advanced: 79, elite: 95 },
    { age: 75, liftType: "Deadlift", gender: "female", bodyWeight: 136, physicallyActive: 20, beginner: 48, intermediate: 61, advanced: 79, elite: 95 },
  
    // Age 80-89 (midpoint 85)
    { age: 85, liftType: "Deadlift", gender: "female", bodyWeight: 57, physicallyActive: 15, beginner: 34, intermediate: 44, advanced: 53, elite: 68 },
    { age: 85, liftType: "Deadlift", gender: "female", bodyWeight: 68, physicallyActive: 15, beginner: 35, intermediate: 45, advanced: 55, elite: 69 },
    { age: 85, liftType: "Deadlift", gender: "female", bodyWeight: 79, physicallyActive: 16, beginner: 37, intermediate: 48, advanced: 58, elite: 74 },
    { age: 85, liftType: "Deadlift", gender: "female", bodyWeight: 91, physicallyActive: 16, beginner: 38, intermediate: 48, advanced: 59, elite: 75 },
    { age: 85, liftType: "Deadlift", gender: "female", bodyWeight: 102, physicallyActive: 16, beginner: 38, intermediate: 50, advanced: 65, elite: 76 },
    { age: 85, liftType: "Deadlift", gender: "female", bodyWeight: 113, physicallyActive: 16, beginner: 38, intermediate: 49, advanced: 65, elite: 77 },
    { age: 85, liftType: "Deadlift", gender: "female", bodyWeight: 136, physicallyActive: 17, beginner: 39, intermediate: 50, advanced: 65, elite: 77 },

  // Strict Press Male Section
  // Age 15-19 (midpoint 17)
  { age: 17, liftType: "Strict Press", gender: "male", bodyWeight: 57, physicallyActive: 18, beginner: 26, intermediate: 33, advanced: 41, elite: 53 },
  { age: 17, liftType: "Strict Press", gender: "male", bodyWeight: 68, physicallyActive: 22, beginner: 31, intermediate: 40, advanced: 49, elite: 64 },
  { age: 17, liftType: "Strict Press", gender: "male", bodyWeight: 79, physicallyActive: 24, beginner: 34, intermediate: 44, advanced: 54, elite: 70 },
  { age: 17, liftType: "Strict Press", gender: "male", bodyWeight: 91, physicallyActive: 28, beginner: 39, intermediate: 50, advanced: 61, elite: 80 },
  { age: 17, liftType: "Strict Press", gender: "male", bodyWeight: 102, physicallyActive: 29, beginner: 40, intermediate: 51, advanced: 63, elite: 83 },
  { age: 17, liftType: "Strict Press", gender: "male", bodyWeight: 113, physicallyActive: 29, beginner: 41, intermediate: 53, advanced: 65, elite: 85 },
  { age: 17, liftType: "Strict Press", gender: "male", bodyWeight: 136, physicallyActive: 31, beginner: 43, intermediate: 56, advanced: 69, elite: 90 },

    // Age 20-29 (midpoint 25)
    { age: 25, liftType: "Strict Press", gender: "male", bodyWeight: 57, physicallyActive: 23, beginner: 32, intermediate: 42, advanced: 51, elite: 67 },
    { age: 25, liftType: "Strict Press", gender: "male", bodyWeight: 68, physicallyActive: 28, beginner: 39, intermediate: 51, advanced: 62, elite: 82 },
    { age: 25, liftType: "Strict Press", gender: "male", bodyWeight: 79, physicallyActive: 31, beginner: 43, intermediate: 55, advanced: 68, elite: 89 },
    { age: 25, liftType: "Strict Press", gender: "male", bodyWeight: 91, physicallyActive: 35, beginner: 49, intermediate: 63, advanced: 78, elite: 102 },
    { age: 25, liftType: "Strict Press", gender: "male", bodyWeight: 102, physicallyActive: 36, beginner: 50, intermediate: 65, advanced: 80, elite: 105 },
    { age: 25, liftType: "Strict Press", gender: "male", bodyWeight: 113, physicallyActive: 37, beginner: 52, intermediate: 67, advanced: 82, elite: 108 },
    { age: 25, liftType: "Strict Press", gender: "male", bodyWeight: 136, physicallyActive: 39, beginner: 55, intermediate: 70, advanced: 87, elite: 114 },
  
    // Age 30-39 (midpoint 35)
    { age: 35, liftType: "Strict Press", gender: "male", bodyWeight: 57, physicallyActive: 25, beginner: 35, intermediate: 45, advanced: 55, elite: 72 },
    { age: 35, liftType: "Strict Press", gender: "male", bodyWeight: 68, physicallyActive: 30, beginner: 42, intermediate: 54, advanced: 67, elite: 88 },
    { age: 35, liftType: "Strict Press", gender: "male", bodyWeight: 79, physicallyActive: 33, beginner: 46, intermediate: 59, advanced: 73, elite: 96 },
    { age: 35, liftType: "Strict Press", gender: "male", bodyWeight: 91, physicallyActive: 38, beginner: 53, intermediate: 68, advanced: 84, elite: 109 },
    { age: 35, liftType: "Strict Press", gender: "male", bodyWeight: 102, physicallyActive: 39, beginner: 54, intermediate: 70, advanced: 86, elite: 112 },
    { age: 35, liftType: "Strict Press", gender: "male", bodyWeight: 113, physicallyActive: 40, beginner: 56, intermediate: 72, advanced: 89, elite: 116 },
    { age: 35, liftType: "Strict Press", gender: "male", bodyWeight: 136, physicallyActive: 42, beginner: 59, intermediate: 76, advanced: 93, elite: 122 },
  
    // Age 40-49 (midpoint 45)
    { age: 45, liftType: "Strict Press", gender: "male", bodyWeight: 57, physicallyActive: 21, beginner: 30, intermediate: 38, advanced: 47, elite: 62 },
    { age: 45, liftType: "Strict Press", gender: "male", bodyWeight: 68, physicallyActive: 26, beginner: 36, intermediate: 47, advanced: 58, elite: 75 },
    { age: 45, liftType: "Strict Press", gender: "male", bodyWeight: 79, physicallyActive: 28, beginner: 40, intermediate: 51, advanced: 63, elite: 82 },
    { age: 45, liftType: "Strict Press", gender: "male", bodyWeight: 91, physicallyActive: 32, beginner: 45, intermediate: 58, advanced: 72, elite: 94 },
    { age: 45, liftType: "Strict Press", gender: "male", bodyWeight: 102, physicallyActive: 33, beginner: 47, intermediate: 60, advanced: 74, elite: 97 },
    { age: 45, liftType: "Strict Press", gender: "male", bodyWeight: 113, physicallyActive: 34, beginner: 48, intermediate: 62, advanced: 76, elite: 100 },
    { age: 45, liftType: "Strict Press", gender: "male", bodyWeight: 136, physicallyActive: 36, beginner: 51, intermediate: 65, advanced: 80, elite: 105 },
  
    // Age 50-59 (midpoint 55)
    { age: 55, liftType: "Strict Press", gender: "male", bodyWeight: 57, physicallyActive: 18, beginner: 26, intermediate: 33, advanced: 41, elite: 53 },
    { age: 55, liftType: "Strict Press", gender: "male", bodyWeight: 68, physicallyActive: 22, beginner: 31, intermediate: 40, advanced: 50, elite: 65 },
    { age: 55, liftType: "Strict Press", gender: "male", bodyWeight: 79, physicallyActive: 24, beginner: 34, intermediate: 44, advanced: 54, elite: 71 },
    { age: 55, liftType: "Strict Press", gender: "male", bodyWeight: 91, physicallyActive: 28, beginner: 39, intermediate: 50, advanced: 62, elite: 81 },
    { age: 55, liftType: "Strict Press", gender: "male", bodyWeight: 102, physicallyActive: 29, beginner: 40, intermediate: 51, advanced: 63, elite: 83 },
    { age: 55, liftType: "Strict Press", gender: "male", bodyWeight: 113, physicallyActive: 30, beginner: 41, intermediate: 53, advanced: 65, elite: 86 },
    { age: 55, liftType: "Strict Press", gender: "male", bodyWeight: 136, physicallyActive: 31, beginner: 44, intermediate: 56, advanced: 69, elite: 90 },
  
    // Age 60-69 (midpoint 65)
    { age: 65, liftType: "Strict Press", gender: "male", bodyWeight: 57, physicallyActive: 17, beginner: 24, intermediate: 31, advanced: 38, elite: 50 },
    { age: 65, liftType: "Strict Press", gender: "male", bodyWeight: 68, physicallyActive: 21, beginner: 29, intermediate: 38, advanced: 46, elite: 61 },
    { age: 65, liftType: "Strict Press", gender: "male", bodyWeight: 79, physicallyActive: 23, beginner: 32, intermediate: 41, advanced: 51, elite: 66 },
    { age: 65, liftType: "Strict Press", gender: "male", bodyWeight: 91, physicallyActive: 26, beginner: 36, intermediate: 47, advanced: 58, elite: 76 },
    { age: 65, liftType: "Strict Press", gender: "male", bodyWeight: 102, physicallyActive: 27, beginner: 38, intermediate: 48, advanced: 60, elite: 78 },
    { age: 65, liftType: "Strict Press", gender: "male", bodyWeight: 113, physicallyActive: 28, beginner: 39, intermediate: 50, advanced: 61, elite: 80 },
    { age: 65, liftType: "Strict Press", gender: "male", bodyWeight: 136, physicallyActive: 29, beginner: 41, intermediate: 53, advanced: 65, elite: 85 },
  
    // Age 70-79 (midpoint 75)
    { age: 75, liftType: "Strict Press", gender: "male", bodyWeight: 57, physicallyActive: 15, beginner: 20, intermediate: 26, advanced: 32, elite: 42 },
    { age: 75, liftType: "Strict Press", gender: "male", bodyWeight: 68, physicallyActive: 18, beginner: 25, intermediate: 32, advanced: 39, elite: 51 },
    { age: 75, liftType: "Strict Press", gender: "male", bodyWeight: 79, physicallyActive: 19, beginner: 27, intermediate: 35, advanced: 43, elite: 56 },
    { age: 75, liftType: "Strict Press", gender: "male", bodyWeight: 91, physicallyActive: 22, beginner: 31, intermediate: 40, advanced: 49, elite: 64 },
    { age: 75, liftType: "Strict Press", gender: "male", bodyWeight: 102, physicallyActive: 23, beginner: 32, intermediate: 41, advanced: 50, elite: 66 },
    { age: 75, liftType: "Strict Press", gender: "male", bodyWeight: 113, physicallyActive: 24, beginner: 33, intermediate: 42, advanced: 52, elite: 68 },
    { age: 75, liftType: "Strict Press", gender: "male", bodyWeight: 136, physicallyActive: 25, beginner: 35, intermediate: 44, advanced: 55, elite: 72 },
  
    // Age 80-89 (midpoint 85)
    { age: 85, liftType: "Strict Press", gender: "male", bodyWeight: 57, physicallyActive: 10, beginner: 14, intermediate: 18, advanced: 22, elite: 29 },
    { age: 85, liftType: "Strict Press", gender: "male", bodyWeight: 68, physicallyActive: 12, beginner: 17, intermediate: 22, advanced: 27, elite: 36 },
    { age: 85, liftType: "Strict Press", gender: "male", bodyWeight: 79, physicallyActive: 13, beginner: 19, intermediate: 24, advanced: 30, elite: 39 },
    { age: 85, liftType: "Strict Press", gender: "male", bodyWeight: 91, physicallyActive: 15, beginner: 21, intermediate: 27, advanced: 34, elite: 44 },
    { age: 85, liftType: "Strict Press", gender: "male", bodyWeight: 102, physicallyActive: 16, beginner: 22, intermediate: 28, advanced: 35, elite: 46 },
    { age: 85, liftType: "Strict Press", gender: "male", bodyWeight: 113, physicallyActive: 16, beginner: 23, intermediate: 29, advanced: 36, elite: 47 },
    { age: 85, liftType: "Strict Press", gender: "male", bodyWeight: 136, physicallyActive: 17, beginner: 24, intermediate: 31, advanced: 38, elite: 50 },


  // Strict Press Female Section
  // Age 15-19 (midpoint 17)
  { age: 17, liftType: "Strict Press", gender: "female", bodyWeight: 57, physicallyActive: 11, beginner: 14, intermediate: 18, advanced: 23, elite: 31 },
  { age: 17, liftType: "Strict Press", gender: "female", bodyWeight: 68, physicallyActive: 13, beginner: 17, intermediate: 20, advanced: 27, elite: 37 },
  { age: 17, liftType: "Strict Press", gender: "female", bodyWeight: 79, physicallyActive: 14, beginner: 18, intermediate: 22, advanced: 29, elite: 40 },
  { age: 17, liftType: "Strict Press", gender: "female", bodyWeight: 91, physicallyActive: 15, beginner: 21, intermediate: 24, advanced: 32, elite: 43 },
  { age: 17, liftType: "Strict Press", gender: "female", bodyWeight: 102, physicallyActive: 16, beginner: 22, intermediate: 26, advanced: 35, elite: 46 },
  { age: 17, liftType: "Strict Press", gender: "female", bodyWeight: 113, physicallyActive: 17, beginner: 24, intermediate: 28, advanced: 37, elite: 48 },
  { age: 17, liftType: "Strict Press", gender: "female", bodyWeight: 136, physicallyActive: 19, beginner: 27, intermediate: 31, advanced: 41, elite: 52 },
  
    // Age 20-29 (midpoint 25)
    { age: 25, liftType: "Strict Press", gender: "female", bodyWeight: 57, physicallyActive: 14, beginner: 18, intermediate: 22, advanced: 29, elite: 39 },
    { age: 25, liftType: "Strict Press", gender: "female", bodyWeight: 68, physicallyActive: 16, beginner: 21, intermediate: 26, advanced: 34, elite: 47 },
    { age: 25, liftType: "Strict Press", gender: "female", bodyWeight: 79, physicallyActive: 18, beginner: 23, intermediate: 28, advanced: 37, elite: 50 },
    { age: 25, liftType: "Strict Press", gender: "female", bodyWeight: 91, physicallyActive: 19, beginner: 26, intermediate: 31, advanced: 40, elite: 54 },
    { age: 25, liftType: "Strict Press", gender: "female", bodyWeight: 102, physicallyActive: 20, beginner: 28, intermediate: 33, advanced: 45, elite: 59 },
    { age: 25, liftType: "Strict Press", gender: "female", bodyWeight: 113, physicallyActive: 21, beginner: 31, intermediate: 35, advanced: 47, elite: 60 },
    { age: 25, liftType: "Strict Press", gender: "female", bodyWeight: 136, physicallyActive: 25, beginner: 34, intermediate: 39, advanced: 52, elite: 66 },
  
    // Age 30-39 (midpoint 35)
    { age: 35, liftType: "Strict Press", gender: "female", bodyWeight: 57, physicallyActive: 15, beginner: 19, intermediate: 24, advanced: 32, elite: 42 },
    { age: 35, liftType: "Strict Press", gender: "female", bodyWeight: 68, physicallyActive: 18, beginner: 23, intermediate: 28, advanced: 37, elite: 50 },
    { age: 35, liftType: "Strict Press", gender: "female", bodyWeight: 79, physicallyActive: 19, beginner: 25, intermediate: 30, advanced: 40, elite: 54 },
    { age: 35, liftType: "Strict Press", gender: "female", bodyWeight: 91, physicallyActive: 20, beginner: 28, intermediate: 33, advanced: 43, elite: 58 },
    { age: 35, liftType: "Strict Press", gender: "female", bodyWeight: 102, physicallyActive: 22, beginner: 30, intermediate: 35, advanced: 48, elite: 63 },
    { age: 35, liftType: "Strict Press", gender: "female", bodyWeight: 113, physicallyActive: 23, beginner: 33, intermediate: 38, advanced: 50, elite: 65 },
    { age: 35, liftType: "Strict Press", gender: "female", bodyWeight: 136, physicallyActive: 27, beginner: 37, intermediate: 42, advanced: 56, elite: 71 },
  
    // Age 40-49 (midpoint 45)
    { age: 45, liftType: "Strict Press", gender: "female", bodyWeight: 57, physicallyActive: 13, beginner: 16, intermediate: 21, advanced: 27, elite: 36 },
    { age: 45, liftType: "Strict Press", gender: "female", bodyWeight: 68, physicallyActive: 15, beginner: 19, intermediate: 24, advanced: 31, elite: 43 },
    { age: 45, liftType: "Strict Press", gender: "female", bodyWeight: 79, physicallyActive: 16, beginner: 21, intermediate: 26, advanced: 34, elite: 46 },
    { age: 45, liftType: "Strict Press", gender: "female", bodyWeight: 91, physicallyActive: 17, beginner: 24, intermediate: 28, advanced: 37, elite: 50 },
    { age: 45, liftType: "Strict Press", gender: "female", bodyWeight: 102, physicallyActive: 19, beginner: 26, intermediate: 30, advanced: 41, elite: 54 },
    { age: 45, liftType: "Strict Press", gender: "female", bodyWeight: 113, physicallyActive: 20, beginner: 28, intermediate: 33, advanced: 43, elite: 56 },
    { age: 45, liftType: "Strict Press", gender: "female", bodyWeight: 136, physicallyActive: 23, beginner: 31, intermediate: 36, advanced: 48, elite: 61 },
  
    // Age 50-59 (midpoint 55)
    { age: 55, liftType: "Strict Press", gender: "female", bodyWeight: 57, physicallyActive: 11, beginner: 14, intermediate: 18, advanced: 23, elite: 31 },
    { age: 55, liftType: "Strict Press", gender: "female", bodyWeight: 68, physicallyActive: 13, beginner: 17, intermediate: 20, advanced: 27, elite: 37 },
    { age: 55, liftType: "Strict Press", gender: "female", bodyWeight: 79, physicallyActive: 14, beginner: 18, intermediate: 22, advanced: 30, elite: 40 },
    { age: 55, liftType: "Strict Press", gender: "female", bodyWeight: 91, physicallyActive: 15, beginner: 21, intermediate: 24, advanced: 32, elite: 43 },
    { age: 55, liftType: "Strict Press", gender: "female", bodyWeight: 102, physicallyActive: 16, beginner: 22, intermediate: 26, advanced: 35, elite: 47 },
    { age: 55, liftType: "Strict Press", gender: "female", bodyWeight: 113, physicallyActive: 17, beginner: 24, intermediate: 28, advanced: 37, elite: 48 },
    { age: 55, liftType: "Strict Press", gender: "female", bodyWeight: 136, physicallyActive: 20, beginner: 27, intermediate: 31, advanced: 41, elite: 52 },
  
    // Age 60-69 (midpoint 65)
    { age: 65, liftType: "Strict Press", gender: "female", bodyWeight: 57, physicallyActive: 11, beginner: 13, intermediate: 17, advanced: 22, elite: 29 },
    { age: 65, liftType: "Strict Press", gender: "female", bodyWeight: 68, physicallyActive: 12, beginner: 15, intermediate: 19, advanced: 25, elite: 35 },
    { age: 65, liftType: "Strict Press", gender: "female", bodyWeight: 79, physicallyActive: 13, beginner: 17, intermediate: 21, advanced: 28, elite: 37 },
    { age: 65, liftType: "Strict Press", gender: "female", bodyWeight: 91, physicallyActive: 14, beginner: 19, intermediate: 23, advanced: 30, elite: 40 },
    { age: 65, liftType: "Strict Press", gender: "female", bodyWeight: 102, physicallyActive: 15, beginner: 21, intermediate: 24, advanced: 33, elite: 44 },
    { age: 65, liftType: "Strict Press", gender: "female", bodyWeight: 113, physicallyActive: 16, beginner: 23, intermediate: 26, advanced: 35, elite: 45 },
    { age: 65, liftType: "Strict Press", gender: "female", bodyWeight: 136, physicallyActive: 18, beginner: 25, intermediate: 29, advanced: 38, elite: 49 },
  
    // Age 70-79 (midpoint 75)
    { age: 75, liftType: "Strict Press", gender: "female", bodyWeight: 57, physicallyActive: 9, beginner: 11, intermediate: 14, advanced: 18, elite: 25 },
    { age: 75, liftType: "Strict Press", gender: "female", bodyWeight: 68, physicallyActive: 10, beginner: 13, intermediate: 16, advanced: 21, elite: 29 },
    { age: 75, liftType: "Strict Press", gender: "female", bodyWeight: 79, physicallyActive: 11, beginner: 15, intermediate: 18, advanced: 23, elite: 32 },
    { age: 75, liftType: "Strict Press", gender: "female", bodyWeight: 91, physicallyActive: 12, beginner: 16, intermediate: 19, advanced: 25, elite: 34 },
    { age: 75, liftType: "Strict Press", gender: "female", bodyWeight: 102, physicallyActive: 13, beginner: 18, intermediate: 21, advanced: 28, elite: 37 },
    { age: 75, liftType: "Strict Press", gender: "female", bodyWeight: 113, physicallyActive: 14, beginner: 19, intermediate: 22, advanced: 29, elite: 38 },
    { age: 75, liftType: "Strict Press", gender: "female", bodyWeight: 136, physicallyActive: 16, beginner: 21, intermediate: 24, advanced: 33, elite: 41 },
  
    // Age 80-89 (midpoint 85)
    { age: 85, liftType: "Strict Press", gender: "female", bodyWeight: 57, physicallyActive: 6, beginner: 8, intermediate: 10, advanced: 13, elite: 17 },
    { age: 85, liftType: "Strict Press", gender: "female", bodyWeight: 68, physicallyActive: 7, beginner: 9, intermediate: 11, advanced: 15, elite: 20 },
    { age: 85, liftType: "Strict Press", gender: "female", bodyWeight: 79, physicallyActive: 8, beginner: 10, intermediate: 12, advanced: 16, elite: 22 },
    { age: 85, liftType: "Strict Press", gender: "female", bodyWeight: 91, physicallyActive: 8, beginner: 11, intermediate: 13, advanced: 17, elite: 23 },
    { age: 85, liftType: "Strict Press", gender: "female", bodyWeight: 102, physicallyActive: 9, beginner: 12, intermediate: 14, advanced: 19, elite: 26 },
    { age: 85, liftType: "Strict Press", gender: "female", bodyWeight: 113, physicallyActive: 9, beginner: 13, intermediate: 15, advanced: 20, elite: 26 },
    { age: 85, liftType: "Strict Press", gender: "female", bodyWeight: 136, physicallyActive: 11, beginner: 15, intermediate: 17, advanced: 22, elite: 29 },
];

// Take the standards data and interpolate the standards for a unique age and body weight
// The user is then given a custom set of 5 standards
export const interpolateStandard = (
  age,
  weightKG,
  gender,
  liftType,
  standards,
) => {
  // devLog( `interpolateStandard. age: ${age}, weight: ${weightKG}, gender: ${gender}, liftType: ${liftType}`,);
  // Filter the dataset based on gender and liftType
  // devLog(`standards:`); devLog(standards);
  const filteredStandards = standards.filter(
    (item) => item.gender === gender && item.liftType === liftType,
  );

  if (filteredStandards.length === 0) return null; // Should not happen

  // devLog(`filteredStandards:`); devLog(filteredStandards);

  // Find the two closest points for age
  const ageArray = [...new Set(filteredStandards.map((obj) => obj.age))];
  const { lower: ageLower, upper: ageUpper } = findNearestPoints(age, ageArray);

  // Interpolate between bodyweight values within a lower and upper age range point for an arbitrary bodyweight in KG
  // We assume the agePoint is an exact match for an age point in the data model set
  // Return an object with the interpolated values for each rating level
  const interpolateByBodyWeight = (
    agePoint,
    bodyWeightKG,
    filteredStandards,
  ) => {
    let ageFilteredStandards = filteredStandards.filter(
      (item) => item.age === agePoint,
    );

    // devLog(`ageFilteredStandards: (agePoint: ${agePoint})`); devLog(ageFilteredStandards);

    const weightArray = [
      ...new Set(ageFilteredStandards.map((obj) => obj.bodyWeight)),
    ];
    // Find the two nearest weights in our data
    const { lower, upper } = findNearestPoints(bodyWeightKG, weightArray);

    let weightLower, weightUpper;
    weightUpper = ageFilteredStandards.find(
      (item) => item.bodyWeight === upper,
    );
    weightLower = ageFilteredStandards.find(
      (item) => item.bodyWeight === lower,
    );

    let weightRatio = (bodyWeightKG - lower) / (upper - lower);
    if (weightRatio < 0) weightRatio = 0;
    if (weightRatio > 1) weightRatio = 1;

    // devLog( `weightRatio: ${weightRatio} (weight: ${bodyWeightKG}, data range: ${lower}-${upper})`,);
    return interpolateStandardsValues(weightLower, weightUpper, weightRatio);
  };

  // Interpolate by bodyweight within the lower and upper age points
  const lowerValues = interpolateByBodyWeight(
    ageLower,
    weightKG,
    filteredStandards,
  );
  // devLog(`interpolate by weight: age ${ageLower}, weight: ${weightKG} `); devLog(lowerValues);

  const upperValues = interpolateByBodyWeight(
    ageUpper,
    weightKG,
    filteredStandards,
  );
  // devLog(`interpolate by weight: age ${ageUpper}, weight: ${weightKG} `); devLog(upperValues);

  if (!lowerValues || !upperValues) {
    // devLog( `could not interpolate values: lowerValues: ${lowerValues}, upperValues: ${upperValues}`,);
    return null; // Handle edge cases
  }

  // Interpolate between the values obtained for lower and upper ages
  let ageRatio = (age - ageLower) / (ageUpper - ageLower);
  if (ageRatio < 0) ageRatio = 0;
  if (ageRatio > 1) ageRatio = 1;
  // devLog(`ageRatio: ${ageRatio} (Age: ${age} range: ${ageLower}-${ageUpper})`);

  return interpolateStandardsValues(lowerValues, upperValues, ageRatio);
};

// Linearly interpolate between two sets of strength standards based on a ratio
const interpolateStandardsValues = (lower, upper, ratio) => {
  return {
    physicallyActive: Math.round(
      lower.physicallyActive +
        (upper.physicallyActive - lower.physicallyActive) * ratio,
    ),
    beginner: Math.round(
      lower.beginner + (upper.beginner - lower.beginner) * ratio,
    ),
    intermediate: Math.round(
      lower.intermediate + (upper.intermediate - lower.intermediate) * ratio,
    ),
    advanced: Math.round(
      lower.advanced + (upper.advanced - lower.advanced) * ratio,
    ),
    elite: Math.round(lower.elite + (upper.elite - lower.elite) * ratio),
  };
};

// Find the two nearest points in a sorted array
// If value is lower than the lowest point return the first two
// If value is higher than the highest point return the last two
const findNearestPoints = (value, sortedArray) => {
  if (value <= sortedArray[0]) {
    return { lower: sortedArray[0], upper: sortedArray[1] };
  } else if (value > sortedArray[sortedArray.length - 1]) {
    return {
      lower: sortedArray[sortedArray.length - 2],
      upper: sortedArray[sortedArray.length - 1],
    };
  } else {
    for (let i = 0; i < sortedArray.length; i++) {
      if (sortedArray[i] >= value) {
        return { lower: sortedArray[i - 1], upper: sortedArray[i] };
      }
    }
  }
  return { lower: null, upper: null };
};
