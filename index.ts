require("dotenv").config();

import axios from "axios";
import { initializeApp, FirebaseOptions } from "firebase/app";
import { doc, getDoc, getFirestore } from "firebase/firestore";
import xlsx from "xlsx";

const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;
const FIREBASE_AUTH_DOMAIN = process.env.FIREBASE_AUTH_DOMAIN;
const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID;
const FIREBASE_STORAGE_BUCKET = process.env.FIREBASE_STORAGE_BUCKET;
const FIREBASE_MESSAGING_SENDER_ID = process.env.FIREBASE_MESSAGING_SENDER_ID;
const FIREBASE_APP_ID = process.env.FIREBASE_APP_ID;
const FIREBASE_MEASUREMENT_ID = process.env.FIREBASE_MEASUREMENT_ID;

interface Task {
  network: string;
  createdAtCEST: string;
  taskName: string;
  opsUrl: string;
}

const networks = [
  "mainnet",
  "polygon",
  "fantom",
  "bsc",
  "avalanche",
  "arbitrum",
];

const getNewTask = async (
  subgraphUrl: string,
  iceCreamAddress: string,
  createdAfter: number
) => {
  try {
    const result = await axios.post(subgraphUrl, {
      query: `
            {
               tasks(
                    first: 1000,
                    orderBy: createdAt,
                    orderDirection: asc,
                    where: {
                        createdAt_gt: "${createdAfter.toString()}", 
                        execAddress_not: "${iceCreamAddress}"
                    }
                ) { 
                    id 
                    createdAt
                }
            }
            `,
    });
    const tasksArray = result.data.data.tasks;

    return tasksArray;
  } catch (error) {
    console.error(error);
    return [];
  }
};

const getSubgraphUrl = (network: string) => {
  switch (network) {
    case "mainnet":
      return "https://api.thegraph.com/subgraphs/name/gelatodigital/poke-me";
    case "polygon":
      return "https://api.thegraph.com/subgraphs/name/gelatodigital/poke-me-polygon";
    case "fantom":
      return "https://api.thegraph.com/subgraphs/name/gelatodigital/poke-me-fantom";
    case "avalanche":
      return "https://api.thegraph.com/subgraphs/name/gelatodigital/poke-me-avalanche";
    case "bsc":
      return "https://api.thegraph.com/subgraphs/name/gelatodigital/poke-me-bsc";
    case "arbitrum":
      return "https://api.thegraph.com/subgraphs/name/gelatodigital/poke-me-arbitrum";
    default:
      return "";
  }
};

const getIceCreamAddress = (network: string) => {
  switch (network) {
    case "mainnet":
      return "0xb74de3f91e04d0920ff26ac28956272e8d67404d";
    case "polygon":
      return "0xb74de3f91e04d0920ff26ac28956272e8d67404d";
    case "fantom":
      return "0x255f82563b5973264e89526345ecea766db3bab2";
    case "avalanche":
      return "0x915e840ce933dd1deda87b08c0f4cce46916fd01";
    case "bsc":
      return "0x915e840ce933dd1deda87b08c0f4cce46916fd01";
    case "arbitrum":
      return "0x0f44eaac6b802be1a4b01df9352aa9370c957f5a";
    default:
      return "";
  }
};

const getChainId = (network: string) => {
  switch (network) {
    case "mainnet":
      return "1";
    case "polygon":
      return "137";
    case "fantom":
      return "250";
    case "avalanche":
      return "43114";
    case "bsc":
      return "56";
    case "arbitrum":
      return "42161";
    default:
      return "";
  }
};

const getOpsUrl = (network: string, taskId: string) => {
  switch (network) {
    case "mainnet":
      return `https://app.gelato.network/task/${taskId}?chainId=1`;
    case "polygon":
      return `https://app.gelato.network/task/${taskId}?chainId=137`;
    case "fantom":
      return `https://app.gelato.network/task/${taskId}?chainId=250`;
    case "avalanche":
      return `https://app.gelato.network/task/${taskId}?chainId=43114`;
    case "bsc":
      return `https://app.gelato.network/task/${taskId}?chainId=56`;
    case "arbitrum":
      return `https://app.gelato.network/task/${taskId}?chainId=42161`;
    default:
      return "";
  }
};

export const startFireBase = (): void => {
  const FIREBASE_CONFIG: FirebaseOptions = {
    apiKey: FIREBASE_API_KEY,
    authDomain: FIREBASE_AUTH_DOMAIN,
    projectId: FIREBASE_PROJECT_ID,
    storageBucket: FIREBASE_STORAGE_BUCKET,
    messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
    appId: FIREBASE_APP_ID,
    measurementId: FIREBASE_MEASUREMENT_ID,
  };

  initializeApp(FIREBASE_CONFIG);
};

export const getTaskName = async (
  taskId: string,
  chainId: string
): Promise<string> => {
  const db = getFirestore();
  let taskName = "Failed to get task name";

  const docRef = doc(db, "task-names", chainId);
  const nameObj = (await getDoc(docRef)).data();
  if (nameObj) taskName = nameObj[taskId];

  return taskName;
};

const exportExcel = (data: Task[]) => {
  const workBook = xlsx.utils.book_new();
  const workSheet = xlsx.utils.json_to_sheet<Task>(data);
  xlsx.utils.book_append_sheet(workBook, workSheet, "Ops");

  const dateAndTime = formatDate(Math.floor(Date.now() / 1000));
  const date = dateAndTime.substring(0, dateAndTime.indexOf(","));
  const dateFormatted = date.replace(/\//g, "_");
  console.log(`Compiling Ops Tasks for : ${dateFormatted}`);
  xlsx.writeFile(workBook, __dirname + `/Ops-${dateFormatted}.xlsx`);
};

const formatDate = (epochS: number): string => {
  const date = new Date(epochS * 1000);
  const formattedDate = date.toLocaleString("en-GB", {
    timeZone: "Europe/Berlin",
  });

  return formattedDate;
};

const main = async () => {
  startFireBase();

  const ONE_DAY = 24 * 60 * 60;
  const now = Math.floor(Date.now() / 1000);
  const createdAfter = now - ONE_DAY;

  //   console.log(`Checking task created in past 1 DAY(S) on network: ${network}`);

  const taskObj: Task[] = [];
  for (const network of networks) {
    const iceCreamAddress = getIceCreamAddress(network);
    const subgraphUrl = getSubgraphUrl(network);
    const chainId = getChainId(network);

    const tasks = await getNewTask(subgraphUrl, iceCreamAddress, createdAfter);

    console.log(`New Tasks on ${network}: ${tasks.length}`);

    for (const task of tasks) {
      const taskId = task.id;
      const opsUrl = getOpsUrl(network, taskId);
      const taskName = await getTaskName(taskId, chainId);
      const createdAtEpoch = Number(task.createdAt);
      const createdAtCEST = formatDate(createdAtEpoch);

      const obj: Task = {
        network,
        createdAtCEST,
        taskName,
        opsUrl,
      };

      taskObj.push(obj);
    }
  }

  exportExcel(taskObj);
  console.log("DONE");

  return;
};

try {
  main().then(() => {
    process.exit(0);
  });
} catch (err) {
  console.error("Error: ", err);
  process.exit(1);
}
