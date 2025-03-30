var start = '2024-01-01';
var end = '2024-08-15';

var image1Kumb = optical
  .filter(ee.Filter.bounds(roiKumb))
  .filter(ee.Filter.date(start, end))
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 1))
  .median()
  .clip(roiKumb)
  .select(['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10', 'B11', 'B12']);
  
// Filter and process radar imagery
var image2Kumb = radar
  .filter(ee.Filter.bounds(roiKumb))
  .filter(ee.Filter.date(start, end))
  .median()
  .clip(roiKumb)
  .select(['VV', 'VH']);

// Combine optical and radar images
var compositeKumb = image1Kumb.addBands(image2Kumb);

Map.addLayer(compositeKumb);

// training samples
var gcps = S.merge(W).merge(F).merge(V);

// Add a random column and split the GCPs into training and validation set
var gcps = gcps.randomColumn();

// 70% training, 30% validation
var trainingGcp = gcps.filter(ee.Filter.lt('random', 0.7));
var validationGcp = gcps.filter(ee.Filter.gte('random', 0.7));

var training = compositeKumb.sampleRegions({
  collection: trainingGcp,
  properties: ['Class'],
  scale: 10,
  tileScale:16
});

var classifier = ee.Classifier.smileRandomForest(
  {
  numberOfTrees:1500,
  variablesPerSplit:2,
  minLeafPopulation:4,
  maxNodes:1000,
  bagFraction:0.5,
}) .train({
  features: training,
  classProperty: 'Class',
  inputProperties: compositeKumb.bandNames()
});


var classifiedKumb = compositeKumb.classify(classifier);

// Visualization parameters
var imageVisParam = {min: 0.0, max: 3000, bands: ['B4', 'B3', 'B2']};
Map.addLayer(compositeKumb, imageVisParam, 'Accra Composite');
Map.addLayer(classifiedKumb, {min: 1, max: 4, palette: ['d60000', '0031ff', '47c822', '006814']}, 'Classified Accra');
Map.centerObject(roiKumb);

var testAccra = classifiedKumb.sampleRegions({
  collection: validationGcp,
  properties: ['Class'],
  tileScale: 16,
  scale: 10,
});

var testConfusionMatrix = testAccra.errorMatrix('Class', 'classification');
print('Confusion Matrix', testConfusionMatrix);
print('Overall Accuracy:', testConfusionMatrix.accuracy());
print('Kappa Accuracy', testConfusionMatrix.kappa());


// // Export classified image to GEE Asset
// Export.image.toAsset({
//   image: classifiedKumb,
//   description: 'Classified_Kumb_2024',
//   assetId: 'users/pwilliamspeniel1/Classified_Kumb_Asset', 
//   scale: 10,
//   region: roiKumb,
//   maxPixels: 1e13  // 
// });

// Export classified image to Google Drive
Export.image.toDrive({
  image: classifiedKumb,
  description: 'Classified_Kumb_Image_2024',
  folder: 'GEE_Exports',
  fileNamePrefix: 'Classified_Kumb_2024',
  scale: 10,
  region: roiKumb,
  fileFormat: 'GeoTIFF',
  maxPixels: 1e13
});
