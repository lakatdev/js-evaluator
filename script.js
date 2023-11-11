google.charts.load('current', { 'packages': ['corechart'] });

function loadFile() {
    let fileInput = document.getElementById("fileInput");
    let file = fileInput.files[0];
    let reader = new FileReader();
    let algorithmDropdown = document.getElementById("algorithmDropdown");

    // Don't do anything if there is no file
    if (!file) {
        return;
    }

    hideResults();
    showSpinner();

    reader.onload = function(e) {
        let contents = e.target.result;
        let selectedAlgorithm = algorithmDropdown.value;
        switch (selectedAlgorithm) {
            case "pref_cb":
                evaluateCBPreferential(contents);
                break;
            case "yesno":
                evaluateYesNo(contents);
                break;
            default:
                break;
        }

        setTimeout(hideSpinner, 500);
        setTimeout(showResults, 500);
    };

    reader.readAsText(file);
}

function evaluateYesNo(csvData) {

    // Load data from csv and remove timestamp column
    let dataArray = csvStringToArray(csvData).map(function(row) {
        return row.slice(1);
    });

    // Extract questions
    let questions = dataArray.shift();

    // Translate input strings to ints
    for (const row of dataArray) {
        for (let i = 0; i < row.length; i++) {
            row[i] = translate(row[i], questions.length);
        }
    }

    //initialize results
    let resultsYes = {}
    let resultsNo = {}
    let resultsAbstain = {}
    for (const question of questions) {
        resultsYes[question] = 0;
        resultsNo[question] = 0;
        resultsAbstain[question] = 0;
    }

    // Evaluate results
    for (const row of dataArray) {
        for (let thisQuestion = 0; thisQuestion < questions.length; thisQuestion++) {
            switch(row[thisQuestion]) {
                case VOTE_YES:
                    resultsYes[questions[thisQuestion]] += 1;
                    break;
                case VOTE_NO:
                    resultsNo[questions[thisQuestion]] += 1;
                    break;
                case VOTE_ABSTAIN:
                    resultsAbstain[questions[thisQuestion]] += 1;
                    break;
            }
        }
    }

    clearTable();
    clearText();
    let table = [["Szavazás", "Igen", "Nem", "Tartózkodom"]];
    for (let i = 0; i < questions.length; i++) {
        addText((i + 1) + ".: " + questions[i] + "<br>");
        let row = [i + 1];
        row.push(resultsYes[questions[i]]);
        row.push(resultsNo[questions[i]]);
        row.push(resultsAbstain[questions[i]]);
        table.push(row);
    }
    displayTable(table);

    clearCharts();
    for (const question of questions) {
        let displayCharts = [["Jelölt", "Preferencia"]];
        displayCharts.push(["Igen", resultsYes[question]]);
        displayCharts.push(["Tartózkodom", resultsAbstain[question]]);
        displayCharts.push(["Nem", resultsNo[question]]);
        addHalfDonutChart(question, displayCharts);
    }
}

function evaluateCBPreferential(csvData) {

    // Load data from csv and remove timestamp column
    let dataArray = csvStringToArray(csvData).map(function(row) {
        return row.slice(1);
    });

    console.log(dataArray);

    // Extract candidates
    let candidates = dataArray.shift().map(function(candidate) {
        let match = candidate.match(/\[(.*?)\]/);
        return match ? match[1] : ''; // Extract the matched string or an empty string if no match
    });

    console.log(dataArray);

    // Translate input strings to ints
    for (const row of dataArray) {
        for (let i = 0; i < row.length; i++) {
            row[i] = translate(row[i], candidates.length);
        }
    }

    console.log(dataArray);

    // Initialize borda counter
    let bordaScore = {};
    for (const candidate of candidates) {
        bordaScore[candidate] = 0;
    }

    // Evaluate borda scores
    for (const row of dataArray) {
        for (let thisCandidateId = 0; thisCandidateId < row.length; thisCandidateId++) {
            for (const otherCandidate of row) {
                if (row[thisCandidateId] < otherCandidate) {
                    bordaScore[candidates[thisCandidateId]] += 1;
                }
            }
        }
    }

    console.log(bordaScore);

    // Has to be a map because that can use arrays as keys
    let comparison = new Map();
    for (let thisCandidateId = 0; thisCandidateId < candidates.length; thisCandidateId++) {
        for (let otherCandidateId = 0; otherCandidateId < candidates.length; otherCandidateId++) {
            if (thisCandidateId !== otherCandidateId) {
                let c1 = candidates[thisCandidateId];
                let c2 = candidates[otherCandidateId];

                let key = JSON.stringify([c1, c2]);
                comparison.set(key, 0);
                for (const row of dataArray) {
                    if (row[thisCandidateId] < row[otherCandidateId]) {
                        comparison.set(key, comparison.get(key) + 1);
                    }
                }
            }
        }
    }

    // Initialize copeland score
    let copelandScore = {};
    for (const candidate of candidates) {
        copelandScore[candidate] = 0;
    }

    // Evaluate copeland score
    for (let names of comparison.keys()) {
        let key = JSON.parse(names);
        let name1 = key[0];
        let name2 = key[1];

        let key1 = JSON.stringify([name1, name2]);
        let key2 = JSON.stringify([name2, name1]);

        if (comparison.get(key1) > comparison.get(key2)) {
            copelandScore[name1] += 1;
        }
        else if (comparison.get(key1) === comparison.get(key2)) {
            copelandScore[name1] += 0.5;
        }
    }

    // Evaluate first preferences before sorting
    let firstPreference = {};
    for (const candidate of candidates) {
        firstPreference[candidate] = 0;
    }
    for (const row of dataArray) {
        let id = row.indexOf(1);
        if (id !== -1) {
            firstPreference[candidates[id]] += 1;
        }
    }

    // Sort
    candidates.sort(function(a, b) {
        if (copelandScore[a] === copelandScore[b]) {
            if (bordaScore[a] < bordaScore[b]) {
                return 1;
            }
            if (bordaScore[a] > bordaScore[b]) {
                return -1;
            }
            return 0;
        }
        return copelandScore[b] - copelandScore[a];
    });

    console.log(copelandScore);
    console.log(bordaScore);
    console.log(comparison);

    let table = [["1st \\ 2nd"]];
    for (const candidate of candidates) {
        table[0].push(candidate);
    }
    table[0].push("Copeland");
    table[0].push("Borda score");

    for (let i = 0; i < candidates.length; i++) {
        let row = [candidates[i]];
        for (let j = 0; j < candidates.length; j++) {
            if (i == j) {
                row.push("X");
            }
            else {
                row.push(
                    comparison.get(JSON.stringify([candidates[i], candidates[j]])) +
                    ":" +
                    comparison.get(JSON.stringify([candidates[j], candidates[i]]))
                );
            }
        }
        row.push(copelandScore[candidates[i]]); //copeland
        row.push(bordaScore[candidates[i]]); //borda

        table.push(row);
    }

    // Display results
    clearCharts();
    displayTable(table);

    clearText();
    addText("A megállapított sorrend: ");
    for (const candidate of candidates) {
        addText(candidate + "; ");
    }

    let displayCopeland = [["Jelölt", "Copeland score"]];
    for (const candidate of candidates) {
        displayCopeland.push([candidate, copelandScore[candidate]]);
    }

    let displayBorda = [["Jelölt", "Borda score"]];
    for (const candidate of candidates) {
        displayBorda.push([candidate, bordaScore[candidate]]);
    }

    let displayFirst = [["Jelölt", "Preferencia"]];
    for (const candidate of candidates) {
        displayFirst.push([candidate, firstPreference[candidate]]);
    }

    addColumnChart("Copeland score", displayCopeland);
    addColumnChart("Borda score", displayBorda);
    addColumnChart("Elsődleges preferencia", displayFirst);
    addHalfDonutChart("Elsődleges preferencia", displayFirst);
}

function addColumnChart(title,  dataArray) {
    // Create a new chart container element
    let chartContainer = document.getElementById("resultCharts");
    let chartContainerChild = document.createElement("div");
    chartContainerChild.id = "chart";
    chartContainer.appendChild(chartContainerChild);
  
    // Set a callback to run when the Google Visualization API is loaded
    google.charts.setOnLoadCallback(drawColumnChart);
  
    // Callback function to draw the chart
    function drawColumnChart() {
        // Create the data table
        let data = google.visualization.arrayToDataTable(dataArray);
    
        // Set chart options
        let options = {
            title: title,
            colors: ['red'],
            legend: 'none',
            bars: 'vertical',
            width: "100%",
            height: 375
        };
    
        // Instantiate and draw the chart
        let chart = new google.visualization.ColumnChart(chartContainerChild);
        chart.draw(data, options);
    }
}

function addHalfDonutChart(title, dataArray) {
    let modifiedDataArray = dataArray.slice();
    let dataSum = 0;
    for (let i = 1; i < modifiedDataArray.length; i++) {
        dataSum += modifiedDataArray[i][1];
    }

    modifiedDataArray.splice(1, 0, ["Jelmagyarázat", dataSum]);

    // Create a new chart container element
    let chartContainer = document.getElementById("resultCharts");
    let chartContainerChild = document.createElement("div");
    chartContainerChild.id = "chart";
    chartContainer.appendChild(chartContainerChild);
  
    // Set a callback to run when the Google Visualization API is loaded
    google.charts.setOnLoadCallback(drawPieChart);

    // Callback function to draw the chart
    function drawPieChart() {
        // Create the data table
        let data = google.visualization.arrayToDataTable(modifiedDataArray);
    
        // Set chart options
        let options = {
            title: title,
            pieHole: 0.5,
            width: "100%",
            height: 375,
            pieStartAngle: 90,
            tooltip: { trigger: 'none' },
            pieSliceText: "value",
            slices: {
                0: {color: "transparent"},
                1: {color: "green"},
                2: {color: "grey"},
                3: {color: "red"},
                4: {color: "black"}
            },
            chartArea: {
                left: 50,
                top: 50,
                width: '80%',
                height: '80%'
            }
        };

        // Instantiate and draw the chart
        let chart = new google.visualization.PieChart(chartContainerChild);
        chart.draw(data, options);
    }
}

function displayTable(data) {
    clearTable();

    for (let i = 0; i < data.length; i++) {
        let rowData = data[i];
        // Create a new table row element
        let row = document.createElement("tr");
        // Iterate through the row data
        for (let j = 0; j < rowData.length; j++) {
            let cellData = rowData[j];

            // Create a new table cell element
            let cell;
            if (i === 0 || j === 0) {
                cell = document.createElement("th");
            }
            else {
                cell = document.createElement("td");
            }
            cell.textContent = cellData;

            // Append the cell to the row
            row.appendChild(cell);
        }
        // Append the row to the table body
        tableBody.appendChild(row);
    }
}

function clearTable() {
    let tableBody = document.getElementById("tableBody");
    tableBody.innerHTML = "";
}

function clearCharts() {
    let chartsBody = document.getElementById("resultCharts");
    chartsBody.innerHTML = "";
}

function clearText() {
    let chartsBody = document.getElementById("resultsText");
    chartsBody.innerHTML = "";
}

function addText(text) {
    let chartsBody = document.getElementById("resultsText");
    chartsBody.innerHTML += text;
}

const csvStringToArray = strData => {
    const objPattern = /(,|\r?\n|\r|^)(?:"([^"]*(?:""[^"]*)*)"|([^,\r\n]*))/gi;
    let arrMatches = null, arrData = [[]];
    while (arrMatches = objPattern.exec(strData)){
        if (arrMatches[1].length && arrMatches[1] !== ",")arrData.push([]);
        arrData[arrData.length - 1].push(arrMatches[2] ? 
            arrMatches[2].replace(/""/g, "\"") :
            arrMatches[3]);
    }
    return arrData;
}

const VOTE_YES = 1
const VOTE_NO = 2
const VOTE_ABSTAIN = 3

const TRANSLATION_MAP = {
    "1.": 1,
    "2.": 2,
    "3.": 3,
    "4.": 4,
    "5.": 5,
    "6.": 6,
    "7.": 7,
    "8.": 8,
    "9.": 9,
    "10.": 10,
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 10,
    "Első hely": 1,
    "Második hely": 2,
    "Harmadik hely": 3,
    "Negyedik hely": 4,
    "Ötödik hely": 5,
    "Hatodik hely": 6,
    "Hetedik hely": 7,
    "Nyolcadik hely": 8,
    "Kilencedik hely": 9,
    "Tizedik hely": 10,
    "igen": 1,
    "nem": 2,
    "tartózkodom": 3,
    "Igen": VOTE_YES,
    "Nem": VOTE_NO,
    "Tartózkodom": VOTE_ABSTAIN
};

function translate(key, max) {
    if (key == undefined) {
        return max;
    }
    return TRANSLATION_MAP[key];
}

function showSpinner() {
    let spinner = document.getElementById("spinner");
    spinner.style.display = "block";
}
  
function hideSpinner() {
    let spinner = document.getElementById("spinner");
    spinner.style.display = "none";
}

function hideResults() {
    let resultsContainer = document.getElementById("results");
    resultsContainer.style.visibility = "hidden";
}

function showResults() {
    let resultsContainer = document.getElementById("results");
    resultsContainer.style.visibility = "visible";
}
