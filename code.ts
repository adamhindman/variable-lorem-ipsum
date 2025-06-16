const inputString: string =
  "lorem ipsum dolor sit amet consectetur adipiscing elit vestibulum vitae erat est donec mollis tincidunt lobortis bibendum congue felis ut rutrum ullamcorper eget sed at eleifend maximus metus eu varius ante vivamus posuere urna a sem pellentesque tellus tempus in lacinia sagittis sapien quis viverra purus non nulla nisl quam venenatis fermentum consequat nec sodales augue morbi accumsan ligula fringilla cras mattis turpis aliquam integer volutpat nibh cursus mauris et dictum laoreet massa suscipit ac pretium id magna justo vel velit facilisis semper elementum ultricies enim sollicitudin vehicula convallis nunc hendrerit arcu odio etiam hac habitasse platea dictumst maecenas gravida phasellus imperdiet rhoncus dapibus ultrices leo scelerisque aliquet egestas duis vulputate malesuada neque diam feugiat tempor pulvinar orci natoque penatibus magnis dis parturient montes nascetur ridiculus mus porta tortor curabitur lacus quisque interdum proin dui efficitur euismod tristique nisi lectus finibus class aptent taciti sociosqu ad litora torquent per conubia nostra inceptos himenaeos praesent placerat condimentum ornare risus iaculis molestie luctus mi pharetra nullam auctor libero ex commodo dignissim fusce porttitor habitant senectus netus fames suspendisse blandit primis faucibus cubilia curae aenean nam eros potenti";

// Initialize with default values
let closeAfter: boolean = false;
let addPunctuation: boolean = false;

// Function to save all preferences
function saveAllPreferences() {
  console.log("Saving all preferences...");
  console.log("Current state:", { closeAfter, addPunctuation });

  return Promise.all([
    figma.clientStorage
      .setAsync("closeAfter", closeAfter)
      .then(() => console.log("Saved closeAfter:", closeAfter))
      .catch((err) => console.error("Failed to save closeAfter:", err)),
    figma.clientStorage
      .setAsync("addPunctuation", addPunctuation)
      .then(() => console.log("Saved addPunctuation:", addPunctuation))
      .catch((err) => console.error("Failed to save addPunctuation:", err)),
  ]);
}

// Load saved preferences
console.log("Loading saved preferences...");
Promise.all([
  figma.clientStorage
    .getAsync("closeAfter")
    .then((val) => {
      console.log("Loaded closeAfter:", val);
      return val;
    })
    .catch((err) => {
      console.error("Error loading closeAfter:", err);
      return false;
    }),
  figma.clientStorage
    .getAsync("addPunctuation")
    .then((val) => {
      console.log("Loaded addPunctuation:", val);
      return val;
    })
    .catch((err) => {
      console.error("Error loading addPunctuation:", err);
      return false;
    }),
  figma.clientStorage
    .getAsync("lastInputValue")
    .then((val) => {
      console.log("Loaded lastInputValue:", val);
      return val;
    })
    .catch((err) => {
      console.error("Error loading lastInputValue:", err);
      return "1-10";
    }),
]).then(([savedCloseAfter, savedAddPunctuation, savedInputValue]) => {
  console.log("All preferences loaded, applying to state");
  closeAfter = savedCloseAfter === true;
  addPunctuation = savedAddPunctuation === true;
  const lastInputValue = savedInputValue || "1-10";
  console.log("Current state:", { closeAfter, addPunctuation, lastInputValue });

  // Send initial values to UI
  figma.ui.postMessage({
    type: "init-preferences",
    closeAfter,
    addPunctuation,
    lastInputValue,
  });
  console.log("Sent preferences to UI");
});

figma.showUI(__html__, {
  themeColors: true,
  width: 320,
  height: 220,
  title: "Lorem Ipsum Range Generator",
});

// Preferences are saved when they change and before plugin closes

const defaultFontName: FontName = {
  family: "Inter",
  style: "Regular",
};

function isSingleFontName(
  fontName: FontName | PluginAPI["mixed"],
): fontName is FontName {
  return (fontName as FontName).family != null;
}

figma.ui.onmessage = (msg: {
  type: string;
  inValue: string;
  inputValue?: string;
  closeAfter: boolean;
  addPunctuation: boolean;
}) => {
  if (msg.type === "update-closeAfter") {
    closeAfter = msg.closeAfter;
    console.log("Updating closeAfter to:", closeAfter);
    // Save all preferences immediately when this changes
    saveAllPreferences().catch((err) =>
      console.error("Failed to save preferences after closeAfter update:", err),
    );
  }
  if (msg.type === "update-addPunctuation") {
    addPunctuation = msg.addPunctuation;
    console.log("Updating addPunctuation to:", addPunctuation);
    // Save all preferences immediately when this changes
    saveAllPreferences().catch((err) =>
      console.error(
        "Failed to save preferences after addPunctuation update:",
        err,
      ),
    );
  }
  if (msg.type === "replace-text") {
    handleFontsAndProcessText(msg);
  }

  // Add support for saving input values
  if (msg.type === "save-input-value" && msg.inputValue) {
    console.log("Saving input value:", msg.inputValue);
    figma.clientStorage
      .setAsync("lastInputValue", msg.inputValue)
      .then(() =>
        console.log("Successfully saved input value:", msg.inputValue),
      )
      .catch((err) => console.error("Failed to save input value:", err));
  }
};

async function loadFonts(params: FontName = defaultFontName): Promise<void> {
  await figma.loadFontAsync(params);
}

async function handleFontsAndProcessText(msg: {
  type: string;
  inValue: string;
}): Promise<void> {
  await loadFonts();
  const range = parseInput(msg.inValue);

  if (figma.currentPage.selection.length === 0) {
    figma.notify("Please select a text node", { timeout: 2000 });
    return;
  }

  for (const selection of figma.currentPage.selection) {
    if (selection.type !== "TEXT") {
      figma.notify("Skipping selections that aren't text", {
        timeout: 1000,
      });
      continue;
    }

    if (!isSingleFontName(selection.fontName)) {
      figma.notify(
        "Mixed text styles aren't supported. Select text with only one font and style.",
        { timeout: 2500 },
      );
      continue;
    }

    await loadFonts(selection.fontName);
    selection.characters = processText(processString(inputString, range));
  }

  if (closeAfter) {
    // Save all preferences before closing the plugin
    saveAllPreferences()
      .then(() => {
        console.log("Preferences saved before closing plugin");
        figma.closePlugin();
      })
      .catch((err) => {
        console.error("Error saving preferences before close:", err);
        figma.closePlugin();
      });
  }
}

// Store word ranges for generated text

function parseInput(value: string) {
  const splitInput: string[] = value.trim().split("-");
  const isRange: boolean = splitInput.length > 1;
  if (isRange) {
    return {
      min: parseInt(splitInput[0], 10),
      max: parseInt(splitInput[1], 10),
    };
  } else {
    const value: number = parseInt(splitInput[0], 10);
    return { min: value, max: value };
  }
}

function processString(
  str: string,
  count: { min: number; max: number },
): string {
  const wordsArray: string[] = str.trim().toLowerCase().split(/\s+/);
  const uniqueWords: string[] = [...new Set(wordsArray)];
  const newString: string[] = [];
  const howManyWords: number =
    count.min === count.max
      ? count.max
      : Math.floor(Math.random() * (count.max - count.min + 1) + count.min);
  for (let i = 0; i < howManyWords; i++) {
    const randomIndex: number = Math.floor(Math.random() * uniqueWords.length);
    newString.push(uniqueWords[randomIndex]);
  }
  const output: string = newString.join(" ");
  return output;
}

function getRandom<T>(array: T[]): T {
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
}

// Utility function left for potential future use
// function getUniqueWordsInString(string: string) {
//   return string
//     .split(" ")
//     .filter(function (item, i, allItems) {
//       return i == allItems.indexOf(item);
//     })
//     .join(" ");
// }

function processText(result: string): string {
  result = result.charAt(0).toUpperCase() + result.slice(1);
  const lineEndPunctuation: string[] = [".", ".", ".", ".", ".", ".", "!", "?"];
  const inlinePunctuation: string[] = [",", ",", ",", "."];
  if (result.charAt(result.length - 1) !== "." && addPunctuation) {
    result += getRandom(lineEndPunctuation); // Add a period at the end if not already present
  }
  const words: string[] = result.split(" ");
  const numberOfPeriods: number = Math.floor(words.length / 7); // Decide on number of periods to insert

  for (let i = 0; i < numberOfPeriods; i++) {
    const randomIndex: number =
      Math.floor(Math.random() * (words.length - 2)) + 1; // Random index, avoiding start and end
    const currChar: string = words[randomIndex].charAt(
      words[randomIndex].length - 1,
    );
    if (/^[a-zA-Z]$/.test(currChar) && addPunctuation) {
      words[randomIndex] += getRandom(inlinePunctuation);
    }
    if (randomIndex + 1 < words.length && addPunctuation) {
      if (words[randomIndex].endsWith(".")) {
        words[randomIndex + 1] =
          words[randomIndex + 1].charAt(0).toUpperCase() +
          words[randomIndex + 1].slice(1);
      }
    }
  }
  return words.join(" ");
}
