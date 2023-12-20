/** @format */

// A function we call on the demo data to always keep it fresh
// Don't let it jitter the final date to keep the most recent session card fairly predictable in height
export function transposeDatesToToday(parsedData, addJitter) {
  // Constants for jitter settings
  const JITTER_DATE_RANGE = 2;
  const JITTER_REPS_RANGE = 1;
  const JITTER_PROBABILITY = 0.5; // 50% chance to apply jitter

  if (parsedData.length === 0) return parsedData;

  const today = new Date();
  const lastDataDate = new Date(parsedData[parsedData.length - 1].date);
  const dayDifference = Math.floor(
    (today - lastDataDate) / (1000 * 60 * 60 * 24),
  );

  let lastDateJitter = 0;
  let lastDate = "";

  const updatedData = parsedData.map((item, index) => {
    const itemDate = new Date(item.date);

    // Apply date jitter with a certain probability, but not for the last item
    if (
      addJitter &&
      item.date !== lastDate &&
      index !== parsedData.length - 1
    ) {
      if (Math.random() < JITTER_PROBABILITY) {
        // Apply date jitter
        lastDateJitter =
          Math.floor(Math.random() * (JITTER_DATE_RANGE * 2 + 1)) -
          JITTER_DATE_RANGE;
      } else {
        // No date jitter
        lastDateJitter = 0;
      }
      lastDate = item.date;
    }

    itemDate.setDate(itemDate.getDate() + dayDifference + lastDateJitter);

    // Apply reps jitter
    let jitteredReps = item.reps;
    if (addJitter && "reps" in item) {
      let repsJitter =
        Math.floor(Math.random() * (JITTER_REPS_RANGE * 2 + 1)) -
        JITTER_REPS_RANGE;
      jitteredReps = Math.max(item.reps + repsJitter, 0);
    }

    return {
      ...item,
      date: itemDate.toISOString().split("T")[0],
      reps: jitteredReps,
    };
  });

  // Sorting the updated data by date
  updatedData.sort((a, b) => new Date(a.date) - new Date(b.date));

  return updatedData;
}

// Our sample parsedData format
// It is always sorted date ascending
export const sampleParsedData = [
  {
    date: "2022-05-02",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-02",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-02",
    liftType: "Back Squat",
    reps: 5,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-02",
    liftType: "Back Squat",
    reps: 5,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-02",
    liftType: "Back Squat",
    reps: 5,
    weight: 135,
    unitType: "lb",
    notes: "First session complete!",
  },
  {
    date: "2022-05-02",
    liftType: "Bench Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-02",
    liftType: "Bench Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-02",
    liftType: "Bench Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-02",
    liftType: "Deadlift",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-02",
    liftType: "Deadlift",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-02",
    liftType: "Deadlift",
    reps: 5,
    weight: 145,
    unitType: "lb",
  },
  {
    date: "2022-05-04",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-04",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-04",
    liftType: "Back Squat",
    reps: 5,
    weight: 145,
    unitType: "lb",
  },
  {
    date: "2022-05-04",
    liftType: "Back Squat",
    reps: 5,
    weight: 145,
    unitType: "lb",
  },
  {
    date: "2022-05-04",
    liftType: "Back Squat",
    reps: 5,
    weight: 145,
    unitType: "lb",
    notes: "Back squats making feel strong.",
  },
  {
    date: "2022-05-04",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-04",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-04",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-06",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-06",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-06",
    liftType: "Back Squat",
    reps: 5,
    weight: 155,
    unitType: "lb",
  },
  {
    date: "2022-05-06",
    liftType: "Back Squat",
    reps: 5,
    weight: 155,
    unitType: "lb",
  },
  {
    date: "2022-05-06",
    liftType: "Back Squat",
    reps: 5,
    weight: 155,
    unitType: "lb",
    notes: "Now wearing lever belt.",
  },
  {
    date: "2022-05-06",
    liftType: "Bench Press",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-06",
    liftType: "Bench Press",
    reps: 5,
    weight: 55,
    unitType: "lb",
  },
  {
    date: "2022-05-06",
    liftType: "Bench Press",
    reps: 5,
    weight: 55,
    unitType: "lb",
  },
  {
    date: "2022-05-06",
    liftType: "Bench Press",
    reps: 5,
    weight: 55,
    unitType: "lb",
  },
  {
    date: "2022-05-06",
    liftType: "Deadlift",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-06",
    liftType: "Deadlift",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-06",
    liftType: "Deadlift",
    reps: 5,
    weight: 170,
    unitType: "lb",
  },
  {
    date: "2022-05-09",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-09",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-09",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-09",
    liftType: "Back Squat",
    reps: 5,
    weight: 160,
    unitType: "lb",
  },
  {
    date: "2022-05-09",
    liftType: "Back Squat",
    reps: 5,
    weight: 160,
    unitType: "lb",
  },
  {
    date: "2022-05-09",
    liftType: "Back Squat",
    reps: 5,
    weight: 160,
    unitType: "lb",
  },
  {
    date: "2022-05-09",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-09",
    liftType: "Overhead Press",
    reps: 5,
    weight: 55,
    unitType: "lb",
  },
  {
    date: "2022-05-09",
    liftType: "Overhead Press",
    reps: 5,
    weight: 55,
    unitType: "lb",
  },
  {
    date: "2022-05-09",
    liftType: "Overhead Press",
    reps: 5,
    weight: 55,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Back Squat",
    reps: 3,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Back Squat",
    reps: 2,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Back Squat",
    reps: 5,
    weight: 165,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Back Squat",
    reps: 5,
    weight: 165,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Back Squat",
    reps: 5,
    weight: 165,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Bench Press",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Bench Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Bench Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Bench Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Deadlift",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Deadlift",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Deadlift",
    reps: 5,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-11",
    liftType: "Deadlift",
    reps: 5,
    weight: 190,
    unitType: "lb",
  },
  {
    date: "2022-05-13",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-13",
    liftType: "Back Squat",
    reps: 3,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-13",
    liftType: "Back Squat",
    reps: 2,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-13",
    liftType: "Back Squat",
    reps: 5,
    weight: 170,
    unitType: "lb",
  },
  {
    date: "2022-05-13",
    liftType: "Back Squat",
    reps: 5,
    weight: 170,
    unitType: "lb",
  },
  {
    date: "2022-05-13",
    liftType: "Back Squat",
    reps: 5,
    weight: 170,
    unitType: "lb",
  },
  {
    date: "2022-05-13",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-13",
    liftType: "Overhead Press",
    reps: 5,
    weight: 60,
    unitType: "lb",
  },
  {
    date: "2022-05-13",
    liftType: "Overhead Press",
    reps: 5,
    weight: 60,
    unitType: "lb",
  },
  {
    date: "2022-05-13",
    liftType: "Overhead Press",
    reps: 5,
    weight: 60,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Back Squat",
    reps: 2,
    weight: 160,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Back Squat",
    reps: 5,
    weight: 175,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Back Squat",
    reps: 5,
    weight: 175,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Back Squat",
    reps: 5,
    weight: 175,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Bench Press",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Bench Press",
    reps: 5,
    weight: 75,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Bench Press",
    reps: 5,
    weight: 75,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Bench Press",
    reps: 5,
    weight: 75,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Deadlift",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Deadlift",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Deadlift",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-16",
    liftType: "Deadlift",
    reps: 5,
    weight: 200,
    unitType: "lb",
  },
  {
    date: "2022-05-18",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-18",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-18",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-18",
    liftType: "Back Squat",
    reps: 2,
    weight: 160,
    unitType: "lb",
  },
  {
    date: "2022-05-18",
    liftType: "Back Squat",
    reps: 5,
    weight: 180,
    unitType: "lb",
  },
  {
    date: "2022-05-18",
    liftType: "Back Squat",
    reps: 5,
    weight: 180,
    unitType: "lb",
  },
  {
    date: "2022-05-18",
    liftType: "Back Squat",
    reps: 5,
    weight: 180,
    unitType: "lb",
  },
  {
    date: "2022-05-18",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-18",
    liftType: "Overhead Press",
    reps: 5,
    weight: 60,
    unitType: "lb",
  },
  {
    date: "2022-05-18",
    liftType: "Overhead Press",
    reps: 5,
    weight: 60,
    unitType: "lb",
  },
  {
    date: "2022-05-18",
    liftType: "Overhead Press",
    reps: 5,
    weight: 60,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
    notes: "",
    URL: "https://youtu.be/2kEC7X1FUIg?t=36",
  },
  {
    date: "2022-05-20",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Back Squat",
    reps: 2,
    weight: 160,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Back Squat",
    reps: 5,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Back Squat",
    reps: 5,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Back Squat",
    reps: 5,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Bench Press",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Bench Press",
    reps: 5,
    weight: 80,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Bench Press",
    reps: 5,
    weight: 80,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Bench Press",
    reps: 5,
    weight: 80,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Deadlift",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Deadlift",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Deadlift",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Deadlift",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-05-20",
    liftType: "Deadlift",
    reps: 5,
    weight: 215,
    unitType: "lb",
  },
  {
    date: "2022-05-23",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-23",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-23",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-23",
    liftType: "Back Squat",
    reps: 2,
    weight: 160,
    unitType: "lb",
  },
  {
    date: "2022-05-23",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-05-23",
    liftType: "Back Squat",
    reps: 5,
    weight: 195,
    unitType: "lb",
  },
  {
    date: "2022-05-23",
    liftType: "Back Squat",
    reps: 5,
    weight: 195,
    unitType: "lb",
  },
  {
    date: "2022-05-23",
    liftType: "Back Squat",
    reps: 5,
    weight: 195,
    unitType: "lb",
  },
  {
    date: "2022-05-23",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-23",
    liftType: "Overhead Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-05-23",
    liftType: "Overhead Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-05-23",
    liftType: "Overhead Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Back Squat",
    reps: 5,
    weight: 205,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Back Squat",
    reps: 5,
    weight: 205,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Back Squat",
    reps: 5,
    weight: 205,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Back Squat",
    reps: 5,
    weight: 205,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Bench Press",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Bench Press",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Bench Press",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Bench Press",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Deadlift",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Deadlift",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Deadlift",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Deadlift",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-05-25",
    liftType: "Deadlift",
    reps: 5,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-05-27",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-27",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-27",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-27",
    liftType: "Back Squat",
    reps: 2,
    weight: 160,
    unitType: "lb",
  },
  {
    date: "2022-05-27",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-05-27",
    liftType: "Back Squat",
    reps: 5,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-05-27",
    liftType: "Back Squat",
    reps: 5,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-05-27",
    liftType: "Back Squat",
    reps: 5,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-05-27",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-27",
    liftType: "Overhead Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-05-27",
    liftType: "Overhead Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-05-27",
    liftType: "Overhead Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-05-30",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-30",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-05-30",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-05-30",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-05-30",
    liftType: "Back Squat",
    reps: 5,
    weight: 235,
    unitType: "lb",
  },
  {
    date: "2022-05-30",
    liftType: "Back Squat",
    reps: 5,
    weight: 235,
    unitType: "lb",
  },
  {
    date: "2022-05-30",
    liftType: "Back Squat",
    reps: 5,
    weight: 235,
    unitType: "lb",
  },
  {
    date: "2022-05-30",
    liftType: "Bench Press",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-05-30",
    liftType: "Bench Press",
    reps: 5,
    weight: 105,
    unitType: "lb",
  },
  {
    date: "2022-05-30",
    liftType: "Bench Press",
    reps: 5,
    weight: 105,
    unitType: "lb",
  },
  {
    date: "2022-05-30",
    liftType: "Bench Press",
    reps: 5,
    weight: 105,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Back Squat",
    reps: 5,
    weight: 245,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Back Squat",
    reps: 5,
    weight: 245,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Back Squat",
    reps: 5,
    weight: 245,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Overhead Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Overhead Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Overhead Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Deadlift",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Deadlift",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Deadlift",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Deadlift",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-01",
    liftType: "Deadlift",
    reps: 5,
    weight: 235,
    unitType: "lb",
  },
  {
    date: "2022-06-03",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-03",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-03",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-03",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-03",
    liftType: "Back Squat",
    reps: 5,
    weight: 255,
    unitType: "lb",
  },
  {
    date: "2022-06-03",
    liftType: "Back Squat",
    reps: 5,
    weight: 255,
    unitType: "lb",
  },
  {
    date: "2022-06-03",
    liftType: "Back Squat",
    reps: 5,
    weight: 255,
    unitType: "lb",
  },
  {
    date: "2022-06-03",
    liftType: "Bench Press",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-03",
    liftType: "Bench Press",
    reps: 2,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-03",
    liftType: "Bench Press",
    reps: 5,
    weight: 115,
    unitType: "lb",
  },
  {
    date: "2022-06-03",
    liftType: "Bench Press",
    reps: 5,
    weight: 115,
    unitType: "lb",
  },
  {
    date: "2022-06-03",
    liftType: "Bench Press",
    reps: 5,
    weight: 115,
    unitType: "lb",
  },
  {
    date: "2022-06-06",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-06",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-06",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-06",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-06",
    liftType: "Back Squat",
    reps: 1,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-06-06",
    liftType: "Back Squat",
    reps: 5,
    weight: 265,
    unitType: "lb",
  },
  {
    date: "2022-06-06",
    liftType: "Back Squat",
    reps: 5,
    weight: 265,
    unitType: "lb",
  },
  {
    date: "2022-06-06",
    liftType: "Back Squat",
    reps: 5,
    weight: 265,
    unitType: "lb",
  },
  {
    date: "2022-06-06",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-06",
    liftType: "Overhead Press",
    reps: 5,
    weight: 70,
    unitType: "lb",
  },
  {
    date: "2022-06-06",
    liftType: "Overhead Press",
    reps: 5,
    weight: 70,
    unitType: "lb",
  },
  {
    date: "2022-06-06",
    liftType: "Overhead Press",
    reps: 5,
    weight: 70,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Back Squat",
    reps: 1,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Back Squat",
    reps: 5,
    weight: 245,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Back Squat",
    reps: 5,
    weight: 245,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Back Squat",
    reps: 5,
    weight: 245,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Bench Press",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Bench Press",
    reps: 2,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Bench Press",
    reps: 5,
    weight: 115,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Bench Press",
    reps: 5,
    weight: 115,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Bench Press",
    reps: 5,
    weight: 115,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Deadlift",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Deadlift",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Deadlift",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Deadlift",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-08",
    liftType: "Deadlift",
    reps: 5,
    weight: 245,
    unitType: "lb",
  },
  {
    date: "2022-06-10",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-10",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-10",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-10",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-10",
    liftType: "Back Squat",
    reps: 1,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-06-10",
    liftType: "Back Squat",
    reps: 5,
    weight: 255,
    unitType: "lb",
  },
  {
    date: "2022-06-10",
    liftType: "Back Squat",
    reps: 5,
    weight: 255,
    unitType: "lb",
  },
  {
    date: "2022-06-10",
    liftType: "Back Squat",
    reps: 5,
    weight: 255,
    unitType: "lb",
  },
  {
    date: "2022-06-10",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-10",
    liftType: "Overhead Press",
    reps: 5,
    weight: 75,
    unitType: "lb",
  },
  {
    date: "2022-06-10",
    liftType: "Overhead Press",
    reps: 5,
    weight: 75,
    unitType: "lb",
  },
  {
    date: "2022-06-10",
    liftType: "Overhead Press",
    reps: 5,
    weight: 75,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Back Squat",
    reps: 1,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Back Squat",
    reps: 5,
    weight: 260,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Back Squat",
    reps: 5,
    weight: 260,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Back Squat",
    reps: 5,
    weight: 260,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Bench Press",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Bench Press",
    reps: 2,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Bench Press",
    reps: 5,
    weight: 120,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Bench Press",
    reps: 5,
    weight: 120,
    unitType: "lb",
  },
  {
    date: "2022-06-13",
    liftType: "Bench Press",
    reps: 5,
    weight: 120,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Back Squat",
    reps: 1,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Back Squat",
    reps: 5,
    weight: 265,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Back Squat",
    reps: 5,
    weight: 265,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Back Squat",
    reps: 5,
    weight: 265,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Overhead Press",
    reps: 5,
    weight: 75,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Overhead Press",
    reps: 5,
    weight: 75,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Overhead Press",
    reps: 5,
    weight: 75,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Deadlift",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Deadlift",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Deadlift",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Deadlift",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-15",
    liftType: "Deadlift",
    reps: 5,
    weight: 265,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Back Squat",
    reps: 1,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Back Squat",
    reps: 5,
    weight: 270,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Back Squat",
    reps: 5,
    weight: 270,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Back Squat",
    reps: 5,
    weight: 270,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Bench Press",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Bench Press",
    reps: 2,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Bench Press",
    reps: 5,
    weight: 125,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Bench Press",
    reps: 5,
    weight: 125,
    unitType: "lb",
  },
  {
    date: "2022-06-17",
    liftType: "Bench Press",
    reps: 5,
    weight: 125,
    unitType: "lb",
  },
  {
    date: "2022-06-20",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-20",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-20",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-20",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-20",
    liftType: "Back Squat",
    reps: 1,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-06-20",
    liftType: "Back Squat",
    reps: 5,
    weight: 275,
    unitType: "lb",
  },
  {
    date: "2022-06-20",
    liftType: "Back Squat",
    reps: 5,
    weight: 275,
    unitType: "lb",
  },
  {
    date: "2022-06-20",
    liftType: "Back Squat",
    reps: 5,
    weight: 275,
    unitType: "lb",
  },
  {
    date: "2022-06-20",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-20",
    liftType: "Overhead Press",
    reps: 5,
    weight: 75,
    unitType: "lb",
  },
  {
    date: "2022-06-20",
    liftType: "Overhead Press",
    reps: 5,
    weight: 75,
    unitType: "lb",
  },
  {
    date: "2022-06-20",
    liftType: "Overhead Press",
    reps: 5,
    weight: 75,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Back Squat",
    reps: 2,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Back Squat",
    reps: 1,
    weight: 255,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Back Squat",
    reps: 5,
    weight: 280,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Back Squat",
    reps: 5,
    weight: 280,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Back Squat",
    reps: 5,
    weight: 280,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Bench Press",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Bench Press",
    reps: 2,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Bench Press",
    reps: 5,
    weight: 125,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Bench Press",
    reps: 5,
    weight: 125,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Bench Press",
    reps: 5,
    weight: 125,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Deadlift",
    reps: 10,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Deadlift",
    reps: 5,
    weight: 95,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Deadlift",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Deadlift",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-22",
    liftType: "Deadlift",
    reps: 5,
    weight: 265,
    unitType: "lb",
  },
  {
    date: "2022-06-24",
    liftType: "Back Squat",
    reps: 10,
    weight: 45,
    unitType: "lb",
    notes:
      'Use "Insert Rows" to always insert new data at the top of the spreadsheet',
  },
  {
    date: "2022-06-24",
    liftType: "Back Squat",
    reps: 5,
    weight: 95,
    unitType: "lb",
    notes: "Enter data anytime on mobile via the Google Sheets app.",
  },
  {
    date: "2022-06-24",
    liftType: "Back Squat",
    reps: 3,
    weight: 135,
    unitType: "lb",
  },
  {
    date: "2022-06-24",
    liftType: "Back Squat",
    reps: 2,
    weight: 185,
    unitType: "lb",
  },
  {
    date: "2022-06-24",
    liftType: "Back Squat",
    reps: 2,
    weight: 225,
    unitType: "lb",
  },
  {
    date: "2022-06-24",
    liftType: "Back Squat",
    reps: 1,
    weight: 255,
    unitType: "lb",
  },
  {
    date: "2022-06-24",
    liftType: "Back Squat",
    reps: 5,
    weight: 285,
    unitType: "lb",
  },
  {
    date: "2022-06-24",
    liftType: "Back Squat",
    reps: 5,
    weight: 285,
    unitType: "lb",
  },
  {
    date: "2022-06-24",
    liftType: "Back Squat",
    reps: 5,
    weight: 285,
    unitType: "lb",
    notes: "Some like to record all warm up sets, others just top sets.",
  },
  {
    date: "2022-06-24",
    liftType: "Overhead Press",
    reps: 5,
    weight: 45,
    unitType: "lb",
  },
  {
    date: "2022-06-24",
    liftType: "Overhead Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-06-24",
    liftType: "Overhead Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
  {
    date: "2022-06-24",
    liftType: "Overhead Press",
    reps: 5,
    weight: 65,
    unitType: "lb",
  },
];
