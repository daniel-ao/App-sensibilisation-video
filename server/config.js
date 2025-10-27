const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

const INCLUDE_LICENSED_VIDEOS = true;

const DATA_JSON_PATH = path.join(PROJECT_ROOT, 'data.json');
const CSV_FILE_PATH = path.join(PROJECT_ROOT, 'data.csv');
const VIDEO_ROOT_PATH = path.join(PROJECT_ROOT, 'Videos_Creative_Common');
const LICENSED_ROOT_PATH = path.join(PROJECT_ROOT, 'Videos');
const ENFANT_ROOT_PATH = path.join(PROJECT_ROOT, 'Video_enfants');

const RESOLUTION_ORDER = ["144p", "240p", "360p", "480p", "720p", "1080p", "4k"];

module.exports = {
    INCLUDE_LICENSED_VIDEOS,
    DATA_JSON_PATH,
    CSV_FILE_PATH,
    VIDEO_ROOT_PATH,
    LICENSED_ROOT_PATH,
    ENFANT_ROOT_PATH,
    RESOLUTION_ORDER
};