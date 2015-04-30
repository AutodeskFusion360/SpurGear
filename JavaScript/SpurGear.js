//Author-Autodesk Inc.
//Description-The addin to create spur gear.

var commandId = 'SpurGearCommandIdJS';

var errorDescription = function(e) {
    return (e.description ? e.description : e);
};

var commandDefinitionById = function(id) {
    var app = adsk.core.Application.get();
    var ui = app.userInterface;
    if (!id) {
        ui.messageBox('commandDefinition id is not specified');
        return null;
    }
    var commandDefinitions_ = ui.commandDefinitions;
    var commandDefinition_ = commandDefinitions_.itemById(id);
    return commandDefinition_;
};

var commandControlById = function(id) {
    var app = adsk.core.Application.get();
    var ui = app.userInterface;
    if (!id) {
        ui.messageBox('commandControl id is not specified');
        return null;
    }
    var workspaces_ = ui.workspaces;
    var modelingWorkspace_ = workspaces_.itemById('FusionSolidEnvironment');
    var toolbarPanels_ = modelingWorkspace_.toolbarPanels;
    var toolbarPanel_ = toolbarPanels_.item(0); // get the first panel in FusionSolidEnvironment
    var toolbarControls_ = toolbarPanel_.controls;
    var toolbarControl_ = toolbarControls_.itemById(id);
    return toolbarControl_;
};

var destroyObject = function(uiObj, tobeDeleteObj) {
    if (uiObj && tobeDeleteObj) {
        if (tobeDeleteObj.isValid) {
            tobeDeleteObj.deleteMe();
        } else {
            uiObj.messageBox('tobeDeleteObj is not a valid object');
        }
    }
};

function run(context) {

    "use strict";
    if (adsk.debug === true) {
        /*jslint debug: true*/
        debugger;
        /*jslint debug: false*/
    }

    var ui;
    try {
        var commandName = 'Create Spur Gear';
        var commandDescription = 'Create a spur gear.';
        var commandResources = './resources';
        
        var app = adsk.core.Application.get();
        ui = app.userInterface;

        var newComp;

        var createNewComponent = function() {
            // Get the active design.
            var product = app.activeProduct;
            var design = adsk.fusion.Design(product);
            var rootComp = design.rootComponent;
            var allOccs = rootComp.occurrences;
            var newOcc = allOccs.addNewComponent(adsk.core.Matrix3D.create());
            newComp = newOcc.component;
        };

        // CommandCreated event handler.
        var onCommandCreated = function(args) {
            try {
                // Connect to the CommandExecuted event.
                var command = args.command;
                command.execute.add(onCommandExecuted);        

                // Define the inputs.
                var inputs = command.commandInputs;

                var initialVal = adsk.core.ValueInput.createByReal(7.62);
                inputs.addValueInput('diaPitch', 'Diametral Pitch.', 'cm' , initialVal);

                var initialVal2 = adsk.core.ValueInput.createByReal(20.0 * (Math.PI / 180));
                inputs.addValueInput('pressureAngle', 'Pressure Angle', 'deg' , initialVal2);

                inputs.addStringValueInput('numTeeth', 'Number of Teeth', '24');

                var initialVal4 = adsk.core.ValueInput.createByReal(2.0);
                inputs.addValueInput('thickness', 'Gear Thickness', 'cm' , initialVal4);
            } 
            catch (e) {
                ui.messageBox('Failed to create command : ' + errorDescription(e));
            }
        };

        // CommandExecuted event handler.
        var onCommandExecuted = function(args) {
            try {
                var unitsMgr = app.activeProduct.unitsManager;
                var command = adsk.core.Command(args.firingEvent.sender);
                var inputs = command.commandInputs;

                var diaPitchInput;
                var pressureAngleInput;
                var numTeethInput;
                var thicknessInput;

                // We need access to the inputs within a command during the execute.
                for (var n = 0; n < inputs.count; n++) {
                    var input = inputs.item(n);
                    if (input.id === 'diaPitch') {
                        diaPitchInput = adsk.core.ValueCommandInput(input);
                    }
                    else if (input.id === 'pressureAngle') {
                        pressureAngleInput = adsk.core.ValueCommandInput(input);
                    }
                    else if (input.id === 'numTeeth') {
                        numTeethInput = adsk.core.StringValueCommandInput(input);
                    }
                    else if (input.id === 'thickness') {
                        thicknessInput = adsk.core.ValueCommandInput(input);
                    }
                }

                var diaPitch;
                var pressureAngle;
                var numTeeth;
                var thickness;

                if (!diaPitchInput || !pressureAngleInput || !numTeethInput || !thicknessInput) {
                    ui.messageBox("One of the inputs don't exist.");

                    diaPitch = 7.62;
                    pressureAngle = 20.0 * (Math.PI / 180);
                    numTeeth = 24;
                    thickness = 3.5;
                }
                else
                {
                    diaPitch = unitsMgr.evaluateExpression(diaPitchInput.expression, "cm");
                    pressureAngle = unitsMgr.evaluateExpression(pressureAngleInput.expression, "deg");
                    thickness = unitsMgr.evaluateExpression(thicknessInput.expression, "cm");

                    if (numTeethInput.value === '') {
                        numTeeth = 24;
                    }
                    else {
                        numTeeth = parseInt(numTeethInput.value);
                    }
                }

                buildGear(diaPitch, numTeeth, pressureAngle, thickness);
            } 
            catch (e) {        
                ui.messageBox('Failed to create gear : ' + errorDescription(e));
            }
        };


        // Calculate points along an involute curve.
        var involutePoint = function(baseCircleRadius, distFromCenterToInvolutePoint){
            var l;
            var alpha;
            var theta;
            var x;
            var y;

            l = Math.sqrt(distFromCenterToInvolutePoint * distFromCenterToInvolutePoint - baseCircleRadius * baseCircleRadius);

            alpha = l / baseCircleRadius;

            theta = alpha - Math.acos(baseCircleRadius / distFromCenterToInvolutePoint);

            x = distFromCenterToInvolutePoint * Math.cos(theta);
            y = distFromCenterToInvolutePoint * Math.sin(theta);

            return adsk.core.Point3D.create(x, y, 0);
        };

        var createExtrude = function(prof, thickness)  {
            var extrudes = newComp.features.extrudeFeatures;
            var extInput = extrudes.createInput(prof, adsk.fusion.FeatureOperations.JoinFeatureOperation);

            var distance = adsk.core.ValueInput.createByReal(thickness);
            extInput.setDistanceExtent(false, distance);
            return extrudes.add(extInput); 
        };

        var getCylinderFace = function(body) {
            for (var n = 0; n < body.faces.count; ++n) {
                var face = body.faces.item(n);
                if (face.geometry.surfaceType == adsk.core.SurfaceTypes.CylinderSurfaceType) {
                    return face;
                }
            }
        };

        // Construct a gear.
        var buildGear = function(diametralPitch, numTeeth, pressureAngle, thickness) {
            createNewComponent();
            if (!newComp) {
                ui.messageBox('New component failed to create', 'New Component Failed');
                return;
            }
            // Create a new sketch.
            var sketches = newComp.sketches;
            var xyPlane = newComp.xYConstructionPlane;
            var sketch = sketches.add(xyPlane);

            // Compute the various values for a gear.
            var pitchDia = numTeeth / diametralPitch;
            var dedendum;
            if (diametralPitch < (20 *(Math.PI/180))) { 
                dedendum = 1.157 / diametralPitch; 
            }
            else {
                dedendum = 1.25 / diametralPitch;
            }
            var rootDiameter = pitchDia - (2 * dedendum);
            var baseCircleDiameter = pitchDia * Math.cos(pressureAngle);
            var outsideDia = (numTeeth + 2) / diametralPitch;

            // Calculate points along the involute curve.
            var involutePointCount = 10;   
            var involuteIntersectionRadius = baseCircleDiameter / 2.0;
            var involutePoints = [];
            var radiusStep = ((outsideDia - involuteIntersectionRadius * 2) / 2) / (involutePointCount - 1);
            for (var i = 0; i < involutePointCount; ++i) {
                var newPoint = involutePoint(baseCircleDiameter / 2.0, involuteIntersectionRadius);
                involutePoints.push(newPoint);
                involuteIntersectionRadius = involuteIntersectionRadius + radiusStep;
            }

            // Determine the angle between the X axis and a line between the origin of the curve
            // and the intersection point between the involute and the pitch diameter circle.
            var pitchInvolutePoint = involutePoint(baseCircleDiameter / 2.0, pitchDia / 2.0);
            var pitchPointAngle = Math.atan(pitchInvolutePoint.y / pitchInvolutePoint.x);

            // Determine the angle defined by the tooth thickness as measured at
            // the pitch diameter circle.
            var tooththicknessAngle = -(2 * Math.PI) / (2 * numTeeth);

            // Rotate the involute so the intersection point lies on the x axis.
            var cosAngle = Math.cos(-pitchPointAngle + (tooththicknessAngle / 2));
            var sinAngle = Math.sin(-pitchPointAngle + (tooththicknessAngle / 2));
            for (i = 0; i < involutePointCount; ++i) {
                involutePoints[i].x = involutePoints[i].x * cosAngle - involutePoints[i].y * sinAngle;
                involutePoints[i].y = involutePoints[i].x * sinAngle + involutePoints[i].y * cosAngle;
            }

            // Create a new set of points with a negated y.  This effectively mirrors the original
            // points about the X axis.
            var involute2Points = [];
            for (i = 0; i < involutePointCount; ++i) {
                involute2Points[i] = adsk.core.Point3D.create(involutePoints[i].x, -involutePoints[i].y, 0);
            }

            var curve1Dist = [];
            var curve1Angle = [];
            for (i = 0; i < involutePointCount; ++i) {
                curve1Dist.push(Math.sqrt(involutePoints[i].x * involutePoints[i].x + involutePoints[i].y * involutePoints[i].y));
                curve1Angle.push(Math.atan(involutePoints[i].y / involutePoints[i].x));
            }

            var curve2Dist = [];
            var curve2Angle = [];
            for (i = 0; i < involutePointCount; ++i) {
                curve2Dist.push(Math.sqrt(involute2Points[i].x * involute2Points[i].x + involute2Points[i].y * involute2Points[i].y));
                curve2Angle.push(Math.atan(involute2Points[i].y / involute2Points[i].x));
            }

            sketch.isComputeDeferred = true;
            var angleDiff = -tooththicknessAngle * 2;

            // Create and load an object collection with the points.
            var pointSet = adsk.core.ObjectCollection.create();
            for (i = 0; i < involutePointCount; ++i) {
                pointSet.add(involutePoints[i]);
            }

            // Create the first spline.
            var spline1 = sketch.sketchCurves.sketchFittedSplines.add(pointSet);

            // Add the involute points for the second spline to an ObjectCollection.
            pointSet = adsk.core.ObjectCollection.create();
            for (i = 0; i < involutePointCount; ++i) {
                pointSet.add(involute2Points[i]);
            }

            // Create the second spline.
            var spline2 = sketch.sketchCurves.sketchFittedSplines.add(pointSet);

            var currentAngle = 0;

            if( baseCircleDiameter >= rootDiameter ){
                var rootPoint1 = adsk.core.Point3D.create((rootDiameter / 2) * Math.cos(curve1Angle[0] + currentAngle), (rootDiameter / 2) * Math.sin(curve1Angle[0] + (currentAngle)), 0);
                sketch.sketchCurves.sketchLines.addByTwoPoints(rootPoint1, spline1.startSketchPoint);

                var rootPoint2 = adsk.core.Point3D.create((rootDiameter / 2) * Math.cos(curve2Angle[0] + (currentAngle)), (rootDiameter / 2) * Math.sin(curve2Angle[0] + (currentAngle)), 0);
                sketch.sketchCurves.sketchLines.addByTwoPoints(rootPoint2, spline2.startSketchPoint);
            }

            var midPoint = adsk.core.Point3D.create((outsideDia / 2) * Math.cos(currentAngle), (outsideDia / 2) * Math.sin(currentAngle), 0);
            sketch.sketchCurves.sketchArcs.addByThreePoints(spline1.endSketchPoint, midPoint, spline2.endSketchPoint);

            currentAngle = angleDiff * 1;

            // Rotate the involute points for the next tooth.
            for (i = 0; i < involutePointCount; ++i) {
                involutePoints[i].x = curve1Dist[i] * Math.cos(curve1Angle[i] + (currentAngle));
                involutePoints[i].y = curve1Dist[i] * Math.sin(curve1Angle[i] + (currentAngle));

                involute2Points[i].x = curve2Dist[i] * Math.cos(curve2Angle[i] + (currentAngle));
                involute2Points[i].y = curve2Dist[i] * Math.sin(curve2Angle[i] + (currentAngle));
            }        

            sketch.sketchCurves.sketchCircles.addByCenterRadius(adsk.core.Point3D.create(0, 0, 0), rootDiameter/2);

            sketch.isComputeDeferred = false;
            // Create the extrusion.
            var profOne = sketch.profiles.item(0);
            var extOne = createExtrude(profOne, thickness);
            var profTwo = sketch.profiles.item(1);
            var extTwo = createExtrude(profTwo, thickness);

            var circularPatterns = newComp.features.circularPatternFeatures;
            var entities = adsk.core.ObjectCollection.create();
            entities.add(extTwo);
            var circularPatternInput = circularPatterns.createInput(entities, getCylinderFace(extOne));
            circularPatternInput.quantity = adsk.core.ValueInput.createByString(numTeeth.toString());
            circularPatterns.add(circularPatternInput);

            var fc = extOne.faces.item(0);
            var bd = fc.body;

            bd.name = 'Gear (' + pitchDia.toFixed(2) + ' pitch dia.)';
        };

        // add a command on create panel in modeling workspace
        var workspaces_ = ui.workspaces;
        var modelingWorkspace_ = workspaces_.itemById('FusionSolidEnvironment');
        var toolbarPanels_ = modelingWorkspace_.toolbarPanels;
        var toolbarPanel_ = toolbarPanels_.item(0); // add the new command under the first panel
        var toolbarControls_ = toolbarPanel_.controls;
        var toolbarControl_ = toolbarControls_.itemById(commandId);
        if (toolbarControl_) {
            ui.messageBox('SpurGear command is already loaded.');
            adsk.terminate();
            return;
        } else {
            var commandDefinition_ = ui.commandDefinitions.itemById(commandId);
            if (!commandDefinition_) {
                commandDefinition_ = ui.commandDefinitions.addButtonDefinition(commandId, commandName, commandDescription, commandResources);
            }
            commandDefinition_.commandCreated.add(onCommandCreated);
            toolbarControl_ = toolbarControls_.addCommand(commandDefinition_, commandId);
            toolbarControl_.isVisible = true;

            if (context.IsApplicationStartup === false) {
                ui.messageBox('SpurGear is loaded successfully.\r\n\r\nA command is added to the create panel in modeling workspace.');
            }
        }
    }
    catch (e) {
        if (ui) {
            ui.messageBox('AddIn Start Failed : ' + errorDescription(e));
            adsk.terminate();
        }
    }
}

function stop(context) {
    var ui;
    try {
        var app = adsk.core.Application.get();
        ui = app.userInterface;
        var objArray = [];

        var commandControl_ = commandControlById(commandId);
        if (commandControl_) {
            objArray.push(commandControl_);
        }
        var commandDefinition_ = commandDefinitionById(commandId);
        if (commandDefinition_) {
            objArray.push(commandDefinition_);
        }

        objArray.forEach(function(obj){
            destroyObject(ui, obj);
        });

    } catch (e) {
        if (ui) {
            ui.messageBox('AddIn Stop Failed : ' + errorDescription(e));
        }
    }
}