/* globals turf */

import { initializeMap } from './map.js';
import { handleMenuBar } from './control.js';


// read files
// reference layers

const db = await fetch('data/data-boundary.json');
const dataBoundary = await db.json();

const census = await fetch('data/census-tract.json');
const censusTracts = await census.json();

const ct = await fetch('data/county.json');
const county = await ct.json();

const HUC10 = await fetch('data/HUC10.geojson');
const huc10 = await HUC10.json();

const HUC12 = await fetch('data/HUC12.json');
const huc12 = await HUC12.json();

const fl = await fetch('data/flowline.json');
const flowline = await fl.json();

const shore = await fetch('data/shoreline-base-to-bridge.geojson');
const shorelineBase = await shore.json();

// working layers
// because the analysis later (turf.intersect) only takes polygon, need to manipulate lines here before adding them

const sb = await fetch('data/sediment-budget-rrbh.geojson');
const sendimentBudget = await sb.json();

const shoretype = await fetch('data/edge-clean.geojson');
const shorelineTypeline = await shoretype.json();
const shorelineType = turf.buffer(shorelineTypeline, 0.01);

const soil = await fetch('data/soil-erosion-k.geojson');
const soilErosion = await soil.json();


window.censusTracts = censusTracts;
window.dataBoundary = dataBoundary;
window.county = county;
window.huc10 = huc10;
window.huc12 = huc12;
window.flowline = flowline;

window.sendimentBudget = sendimentBudget;
window.shorelineBase = shorelineBase;
window.shorelineType = shorelineType;
window.soilErosion = soilErosion;
window.map = initializeMap(censusTracts, dataBoundary, huc10, huc12, shorelineBase, county, flowline, sendimentBudget, shorelineType); // remember to add new layer her as well

// menu bar
handleMenuBar();
