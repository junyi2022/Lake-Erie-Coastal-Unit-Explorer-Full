/* globals turf */
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

import { findClosestData } from './model.js';
import { legend1Style, legend3Style } from './map.js';
import { handleDropdownDisplay, withSpinnerDo, displaySelectPointScoreOnRange, getParsed } from './logistics.js';
import { modelName, colorScale, unitColorScale, getMinMaxFromFeatureArray, handleDownload } from './cal.js';
import { initializePoints, handleMarkerSnap, getFtResolution, munipulateResCollection } from './cal.js';

// similar finder inputs
// get step 1 buttons
const startButtonSim = document.querySelector('.select-point-sim');
const finishButtonSim = document.querySelector('.finish-point-sim');
// get step 2 input boxes
const step2FormSim = document.querySelector('.step-two-form-sim');
const firstDropSim = document.querySelector('#first-priority-sim');
const secondDropSim = document.querySelector('#second-priority-sim');
const thirdDropSim = document.querySelector('#third-priority-sim');
const dropdownAllSim = document.getElementsByClassName('priority-sim'); // all dropdown boxes
const generateResButtonSim = document.querySelector('.generate-resolution-sim');
const finishResButtonSim = document.querySelector('.finish-resolution-sim');
// get step 3 buttons
const fromSliderSim = document.querySelector('#fromSlider');
const toSliderSim = document.querySelector('#toSlider');
const fromInputSim = document.querySelector('#fromInput');
const toInputSim = document.querySelector('#toInput');
const generateGroupButtonSim = document.querySelector('.generate-group-sim');
const finishGroupButtonSim = document.querySelector('.finish-group-sim');
// get step 4 stuff
const downloadButtonSim = document.querySelector('.download-unit-sim');
const fileTypeSelectSim = document.querySelector('.file-type-sim');


// get reverse color scale
const reversedUnitColorScale = (t) => unitColorScale(1 - t);

// shapefile download setting
const shpOptionsSim = {
  folder: 'download_similarity_shp',
  filename: 'similarity_result',
  outputType: 'blob',
  compression: 'DEFLATE',
  types: {
    // point: 'mypoints',
    // polygon: 'mypolygons',
    polyline: 'Coastline By Similarity',
  },
};


// map.js will cal this function for similarity finder
function handleSimilarityCalculations(mid, map2, shorelineBase) {
  const coastLine = turf.lineString(shorelineBase.features[0].geometry.coordinates);

  startButtonSim.addEventListener('click', () => {
    handleSimilarityMapSelection(map2, mid, coastLine);
  });
}


// function for similarity finder
function handleSimilarityMapSelection(map2, mid, coastLine) {
  // clear any existing features / reset
  map2.flyToBounds(map2.zoomRefLayer.getBounds());
  map2.markerLayer.clearLayers();
  map2.pickPointLayer.clearLayers();

  // draggable markers part
  const midMarker = initializePoints(map2, mid);

  midMarker.addEventListener('dragend', () => {
    handleMarkerSnap(coastLine, midMarker, map2);
  });

  // next button part after user selected a point
  // this button is set within the start button to make sure nothing will happen if people do not "start"
  finishButtonSim.addEventListener('click', () => {
    withSpinnerDo(() => {
      const [midMarker] = map2.markerLayer.getLayers();
      // for some reasons there will be more than one marker if rerun this step, only the final one will be valid
      if (midMarker !== void 0) { // void 0 is the same as undefined
        calResForSimilarity(midMarker.getLatLng(), coastLine, map2);
      }
    });
  });
}

// handle marker point after user moved them
function calResForSimilarity(newMid, coastLine, map2) {
  // zoom to the whole coastline
  map2.fitBounds(map2.zoomRefLayer.getBounds());
  // disable step 1 buttons
  startButtonSim.disabled = true;
  finishButtonSim.disabled = true;

  // map selected point on map
  map2.markerLayer.clearLayers();
  const midPointSelect = turf.point([newMid.lng, newMid.lat]);
  map2.pickPointLayer.addData(midPointSelect);

  // handle setp 2 dropdown options
  firstDropSim.disabled = false;
  firstDropSim.addEventListener('change', () => {
    const firstDropSimChoice = firstDropSim.value;
    handleDropdownDisplay(secondDropSim, [firstDropSimChoice]);
    secondDropSim.disabled = false;
  });

  secondDropSim.addEventListener('change', () => {
    const firstDropSimChoice = firstDropSim.value;
    const secondDropSimChoice = secondDropSim.value;
    handleDropdownDisplay(thirdDropSim, [firstDropSimChoice, secondDropSimChoice]);
    thirdDropSim.disabled = false;
  });

  // handle inputs from form
  generateResButtonSim.addEventListener('click', () => {
    withSpinnerDo(() => {
      handleSimCalculations(midPointSelect, step2FormSim, firstDropSim, secondDropSim, thirdDropSim, map2, coastLine);
    });
  });
}

// actual res calculations
function handleSimCalculations(midPointSelect, step2Form, firstDrop, secondDrop, thirdDrop, map2, coastalLine) {
  // zoom to the whole coastline
  map2.fitBounds(map2.zoomRefLayer.getBounds());

  if (map2.colorLayer !== null) {
    map2.colorLayer.clearLayers();
  }

  // check all the boxes are filled
  // process to the calculations when we have everything
  if (step2FormSim.reportValidity() == false) {
    return; // this just means stop
  }

  const resolutionCollection = getFtResolution(coastalLine, 5000); // feature collection of a lot of linestrings
  console.log(resolutionCollection);

  const [firstProp, secondProp, thirdProp] = munipulateResCollection(map2, resolutionCollection, firstDrop, secondDrop, thirdDrop);

  // add the resolution data to map and color that based on the final score of each coastline piece
  map2.colorLayer = L.geoJSON(resolutionCollection, {
    style: (sample) => {
      const colorValue = colorScale(sample.properties.finalValueNormal);
      return {
        stroke: true,
        color: colorValue,
        weight: 3,
      };
    },
  }).addTo(map2);

  // add legend for the resolution box
  map2.legend.onAdd = (map2) => {
    return legend1Style(map2, colorScale, 'legend-content-sim');
  };
  map2.legend.addTo(map2);

  console.log(resolutionCollection);

  // find final score for the selected point
  // findClosestData only takes polygon/line, not point, so need to buffer the point
  const bufferedPoint = turf.buffer(midPointSelect, 0.1);
  const pointScore = findClosestData(resolutionCollection, bufferedPoint);
  console.log(pointScore);

  map2.pickPointLayer.bringToFront()
    .bindTooltip((l) => { // final unit box tooltip options
      return `<p class="unit-tooltip"><strong>Final score: </strong>${pointScore[0].finalValueNormal.toFixed(2)}</p>`;
    }).bindPopup((l) => { // final unit box popup options
      return `<p class="unit-tooltip">Your selected point has a final score of <strong>${pointScore[0].finalValueNormal.toFixed(2)}</strong></p>`;
    });

  // process to the following step if user click next
  finishResButtonSim.addEventListener('click', () => {
    simGroupRes(map2, resolutionCollection, firstProp, secondProp, thirdProp, pointScore);
  });
}

// prepare for filtering
function simGroupRes(map2, resolutionCollection, firstProp, secondProp, thirdProp, pointScore) {
  // enable step 3 box
  fromSliderSim.disabled = false;
  toSliderSim.disabled = false;
  fromInputSim.disabled = false;
  toInputSim.disabled = false;

  // disable step 2 buttons
  finishResButtonSim.disabled = true;
  generateResButtonSim.disabled = true;
  for (const i of dropdownAllSim) {
    i.disabled = true;
  }

  // add selected point's score to range bar
  displaySelectPointScoreOnRange(pointScore[0].finalValueNormal.toFixed(2));

  // handle range input
  generateGroupButtonSim.addEventListener('click', () => {
    handleGroupResSim(map2, resolutionCollection, firstProp, secondProp, thirdProp, pointScore);
  });
}

// filter by range
function handleGroupResSim(map2, resolutionCollection, firstProp, secondProp, thirdProp, pointScore) {
  // zoom to the whole coastline
  map2.fitBounds(map2.zoomRefLayer.getBounds());
  // clear any existing features / reset
  if (map2.finalSimLayer !== null) {
    map2.finalSimLayer.clearLayers();
  }

  // get range input values
  const [from, to] = getParsed(fromSliderSim, toSliderSim);

  const [simGeojson, minSim, maxSim] = selectSimToGeojson(resolutionCollection, from, to, pointScore);
  console.log(simGeojson);

  // add unit legend
  legend3Style(map2, reversedUnitColorScale, minSim, maxSim);

  // add the res in the selected range to map and color that based on the normal final score of each coastline piece
  // adjust pop up based on number of selected priorities
  const firstPropName = modelName[firstDropSim.value];
  if (secondDropSim.value == 'ns') {
    map2.finalSimLayer = L.geoJSON(simGeojson, {
      style: (sample) => {
        // get the absolute value to map the difference of similarity
        const calSimilarity = sample.properties.similarity;
        const colorValue = reversedUnitColorScale(calSimilarity);
        return {
          stroke: true,
          color: colorValue,
          weight: 23,
          opacity: 0.9,
          lineCap: 'butt',
        };
      },
    }).bindTooltip((l) => { // final unit box tooltip options
      return `<p class="unit-tooltip"><strong>Similarity:</strong> ${(1 - l.feature.properties.similarity).toFixed(2)}</p>`;
    }).bindPopup((l) => { // final unit box popup options
      return `<h3 class="unit-pop-title">ID: ${l.feature.properties.ID + 1}</h3>
              <p class="unit-finalscore"><strong>Similarity:</strong> ${(1 - l.feature.properties.similarity).toFixed(2)}</p>
              <p class="unit-finalscore"><strong>Final Score:</strong> ${l.feature.properties.finalValueNormal.toFixed(2)}</p>
              <p class="unit-first-priority"><strong>${firstPropName}:</strong> ${l.feature.properties[firstProp].toFixed(2)}</p>
      `;
    }).addTo(map2);
    map2.colorLayer.bringToFront();
    map2.pickPointLayer.bringToFront();
  } else if (thirdDropSim.value == 'ns') {
    const secondPropName = modelName[secondDropSim.value];
    map2.finalSimLayer = L.geoJSON(simGeojson, {
      style: (sample) => {
        // get the absolute value to map the difference of similarity
        const calSimilarity = sample.properties.similarity;
        const colorValue = reversedUnitColorScale(calSimilarity);
        return {
          stroke: true,
          color: colorValue,
          weight: 23,
          opacity: 0.9,
          lineCap: 'butt',
        };
      },
    }).bindTooltip((l) => { // final unit box tooltip options
      return `<p class="unit-tooltip"><strong>Similarity:</strong> ${(1 - l.feature.properties.similarity).toFixed(2)}</p>`;
    }).bindPopup((l) => { // final unit box popup options
      return `<h3 class="unit-pop-title">ID: ${l.feature.properties.ID + 1}</h3>
              <p class="unit-finalscore"><strong>Similarity:</strong> ${(1 - l.feature.properties.similarity).toFixed(2)}</p>
              <p class="unit-finalscore"><strong>Final Score:</strong> ${l.feature.properties.finalValueNormal.toFixed(2)}</p>
              <p class="unit-first-priority"><strong>${firstPropName}:</strong> ${l.feature.properties[firstProp].toFixed(2)}</p>
              <p class="unit-second-priority"><strong>${secondPropName}:</strong> ${l.feature.properties[secondProp].toFixed(2)}</p>
      `;
    }).addTo(map2);
    map2.colorLayer.bringToFront();
    map2.pickPointLayer.bringToFront();
  } else {
    const secondPropName = modelName[secondDropSim.value];
    const thirdPropName = modelName[thirdDropSim.value];
    map2.finalSimLayer = L.geoJSON(simGeojson, {
      style: (sample) => {
        // get the absolute value to map the difference of similarity
        const calSimilarity = sample.properties.similarity;
        const colorValue = reversedUnitColorScale(calSimilarity);
        return {
          stroke: true,
          color: colorValue,
          weight: 23,
          opacity: 0.9,
          lineCap: 'butt',
        };
      },
    }).bindTooltip((l) => { // final unit box tooltip options
      return `<p class="unit-tooltip"><strong>Similarity:</strong> ${(1 - l.feature.properties.similarity).toFixed(2)}</p>`;
    }).bindPopup((l) => { // final unit box popup options
      return `<h3 class="unit-pop-title">ID: ${l.feature.properties.ID + 1}</h3>
              <p class="unit-finalscore"><strong>Similarity:</strong> ${(1 - l.feature.properties.similarity).toFixed(2)}</p>
              <p class="unit-finalscore"><strong>Final Score:</strong> ${l.feature.properties.finalValueNormal.toFixed(2)}</p>
              <p class="unit-first-priority"><strong>${firstPropName}:</strong> ${l.feature.properties[firstProp].toFixed(2)}</p>
              <p class="unit-second-priority"><strong>${secondPropName}:</strong> ${l.feature.properties[secondProp].toFixed(2)}</p>
              <p class="unit-second-priority"><strong>${thirdPropName}:</strong> ${l.feature.properties[thirdProp].toFixed(2)}</p>
      `;
    }).addTo(map2);
    map2.colorLayer.bringToFront();
    map2.pickPointLayer.bringToFront();
  }

  // finish unit step and go to next step
  finishGroupButtonSim.addEventListener('click', () => {
    fileTypeSelectSim.disabled = false;
    downloadButtonSim.disabled = false;
  });

  // download button handeler
  downloadButtonSim.addEventListener('click', () => {
    handleDownload(simGeojson, fileTypeSelectSim, shpOptionsSim, 'similarity');
  });
}

// use input range to get the final geojson
function selectSimToGeojson(resolutionCollection, from, to, pointScore) {
  // pick the res in the selected range
  const groupArray = [];
  for (let i = 0; i < resolutionCollection.features.length; i++) {
    const eachResScore = resolutionCollection.features[i].properties.finalValueNormal;
    if (eachResScore >= from && eachResScore <= to) {
      groupArray.push(resolutionCollection.features[i]);
    }
  }

  // Calculate the similarity value based on normal final value, need to normalize it to make sure it will be between 0 and 1
  const [minFinal, maxFinal] = getMinMaxFromFeatureArray(groupArray, 'finalValueNormal');
  // here use power scale
  const scaleFunc = d3.scalePow([minFinal, maxFinal], [0, 1]).exponent(1);
  const selectPointSimRefScore = scaleFunc(pointScore[0].finalValueNormal);

  for (let i = 0; i < groupArray.length; i++) {
    groupArray[i].properties.ID = i; // need to update the ID
    groupArray[i].properties.simRefScore = scaleFunc(groupArray[i].properties.finalValueNormal);
    groupArray[i].properties.similarity = Math.abs(groupArray[i].properties.simRefScore - selectPointSimRefScore);
  }

  // prepare similarity range for color later
  const simArray = groupArray.map((f) => f.properties.similarity);
  const minSim = Math.min(...simArray);
  const maxSim = Math.max(...simArray);

  // create the geojson structure
  const geojsonCollection = {'type': 'FeatureCollection', 'features': groupArray};

  return [geojsonCollection, minSim, maxSim];
}


export {
  handleSimilarityCalculations,
};
