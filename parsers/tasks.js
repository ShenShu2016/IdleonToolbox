import { tryToParse } from '../utility/helpers';
import { merits, tasks } from '../data/website-data';

export const getTasks = (idleonData) => {
  const tasksRaw = idleonData?.Tasks || [
    tryToParse(idleonData?.TaskZZ0),
    tryToParse(idleonData?.TaskZZ1),
    tryToParse(idleonData?.TaskZZ2),
    tryToParse(idleonData?.TaskZZ3),
    tryToParse(idleonData?.TaskZZ4),
    tryToParse(idleonData?.TaskZZ5),
  ];

  const tasksDescriptions = tasks?.map((worldTasks, worldIndex) => {
    return worldTasks?.map((task, taskIndex) => {
      const stat = tasksRaw?.[0]?.[worldIndex]?.[taskIndex];
      const level = tasksRaw?.[1]?.[worldIndex]?.[taskIndex];
      const meritReward = Math.round(1 + Math.floor(level / 5));
      let realTask = task;
      if (taskIndex === 8) {
        const randomTaskIndex = tasksRaw?.[5]?.[worldIndex];
        realTask = tasks?.[worldIndex]?.[8 + randomTaskIndex];
      }
      return {
        ...realTask,
        stat,
        level,
        meritReward
      }
    })
  })?.map((worldTasks) => worldTasks?.slice(0, 9));

  const meritsDescriptions = merits?.map((world, worldIndex) => {
    return world?.map((merit, meritIndex) => {
      const level = tasksRaw?.[2]?.[worldIndex]?.[meritIndex];
      return {
        ...merit,
        level
      }
    })
  });
  return { tasks: parseTasks(tasksRaw), tasksDescriptions, meritsDescriptions };
}

const parseTasks = (tasksRaw) => {
  return tasksRaw;
}