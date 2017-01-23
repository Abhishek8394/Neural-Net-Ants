$().ready(function(){
	var bgcanvas = $('#bg-canvas');
	var mainCanvas = $('#main-canvas');
	bgcanvas.css('position','absolute');
	bgcanvas.css('top',mainCanvas.position().top);
	bgcanvas.css('left',mainCanvas.position().left);
	bgcanvas.css('z-index','-1');
});
function sigmoid(a,b=1){
	res = 1/(1+Math.pow(Math.E,((-1)*a/b)));
	return res;
}
var trainedMatrix=[];
//output stuff
var isglowing = false;
var leaveTrail = true;
//---simulation options
var fastMode = 1;
var running = false;
var showFood = true;
var lspeed=0;
var rspeed = 0;
var mainCanvas;
var clearall = true;
// ant properties
var antspeed = 0.5;
var MaxRot = 0.3;
var numFood = 60;
var numAnts = 10;
var antSize = 2;
//--food---
var foodSize = 3;
var foodPool = [];
var antPool = [];
// --neural net
var numInputs = 4;
var numNeurons = 7;
var numLayers = 1;
var numOutput = 2;
// --genetic
var globalTicks = 0;
var currGenNo = 0;
var epochTick = 1000;
var maxant = -1;
var mutationRate = 0.2;
var crossRate = 0.7;
var collisionTolerance = antSize/2 + foodSize;
var genetic=null;
var maxDistort = 3;
var stopgenetic = false;
var pickNBest = 4;
function Neuron(n_inp){
	this.inputNum = n_inp;
	this.weightMatrix = [];
	for(var i =0;i<=n_inp;i++){
		this.weightMatrix[i] = (Math.random()*2)-1;
	}
	this.printWeights = function(){
		console.log(this.weightMatrix);
	};
	this.eval = function(inputs){
		var output = 0;
		for(var i  = 0;i<this.inputNum;i++){
				output = output + (inputs[i]*this.weightMatrix[i]);
		}
		output-=this.weightMatrix[this.inputNum];
		return output;
	}

}
function NeuralLayer(n_neurons,n_inputs){
	this.neuronNum = n_neurons;
	this.neurons = [];
	for(var i=0;i<n_neurons;i++){
		this.neurons[i] = new Neuron(n_inputs);
	}
	this.eval = function(inputs){
		var output = [];
		for(var i =0;i<this.neurons.length;i++){
			output[i] = sigmoid(this.neurons[i].eval(inputs));
		}
		return output;
	};
}
function NeuralNet(n_inputs,n_layers,n_neurons,n_outputs){
	this.inputNum = n_inputs;
	this.outputNum = n_outputs;
	this.layerNum = n_layers;
	this.layers = [];
	for(var i=0;i<n_layers;i++){
		var inp_per_neuron = n_neurons;
		if(i==0){
			inp_per_neuron = n_inputs;
		}
		this.layers[i] = new NeuralLayer(n_neurons,inp_per_neuron);
	}
	//add outputlayer, has #output neurons and #neurons/layer inputs
	this.layers[n_layers] = new NeuralLayer(this.outputNum,n_neurons);
	this.getOutput = function(inputs){
		var outputs = [];
		if(inputs.length!=this.inputNum){
			return outputs;
		}
		var inputCopy = inputs;
		for(var i=0;i<this.layers.length;i++){
			if(i>0){
				inputs =  outputs;
				// console.log(inputs);
			}
			outputs = [];
			outputs = this.layers[i].eval(inputs);
			// console.log('output for layer '+i+": "+outputs);
		}
		return outputs;
	};
	this.getWeightMatrix = function(){
		var weights = [];
		//each layer
		var wctr = 0;
		for(var i = 0;i<this.layers.length;i++){
			//each neuron in a layer
			for(var j = 0;j<this.layers[i].neuronNum;j++){
				// for each input of neuron
				for(var k = 0;k<((this.layers[i].neurons[j].inputNum)+1);k++){		
					// console.log("l: "+i+" n:"+j)			
					weights[wctr++] = this.layers[i].neurons[j].weightMatrix[k];
				}
			}
		}
		// console.log(weights);
		return weights;
	};
	this.setWeightMatrix = function(weightMatrix){
		var wctr = 0;
		for(var i = 0;i<this.layers.length;i++){
			for(var j = 0;j<this.layers[i].neuronNum;j++){
				for(var k = 0;k<((this.layers[i].neurons[j].inputNum)+1);k++){
					this.layers[i].neurons[j].weightMatrix[k] = weightMatrix[wctr++];
				}
			}
		}

	};

}
// var n = new NeuralNet(numInputs,numLayers,numNeurons,numOutput);
// console.log(n.getWeightMatrix());
// // console.log(n.getOutput([1,2,3,4]));
// n.setWeightMatrix([0,1,2,3,4,
// 				   2,4,6,8,10,
// 				   3,6,9,12,15,
// 				   4,8,12,16,20,
// 				   5,10,15,20,25,
// 				   6,12,18,24,30,
// 				   7,14,21,28,35,42,49,
// 				   8,16,24,32,40,48,56
// 				   ]);
// console.log(n);
// console.log(n.getWeightMatrix());
function clamp(v,m,ma){
	if(v<m){return m;}
	if(v>ma){return ma;}
	return v;
}
function Food(x=0,y=0){
	this.x = x;
	this.y = y;
	this.placeRandom = function(mainCanvas){
		this.x = Math.random() * mainCanvas.width;
		this.y = Math.random() * mainCanvas.height;
	};
	this.draw = function(mainCanvas){
		var mcontext = mainCanvas.getContext('2d'); 
		var x = this.x;
		var y = mainCanvas.height - this.y;
		var r = foodSize; 
		mcontext.beginPath();
		mcontext.fillStyle = '#FFFFFF';
		mcontext.arc(x,y,r,0,2*Math.PI);
		mcontext.fill();
		mcontext.closePath();
	};
}
function Ant(x,y,ared,agreen,ablue,aasize = 0.5){
	this.px = x;
	this.py = y;
	this.asize = aasize;
	this.red = ared;
	this.green = agreen;
	this.blue = ablue;
	this.xdirection = 1;
	this.ydirection = 1;
	this.lforce = antspeed;
	this.rforce = antspeed;
	this.angle = 0;
	this.foodCtr = Math.random();
	this.neuralNet = new NeuralNet(numInputs,numLayers,numNeurons,numOutput); 
	this.getRed = function(){return this.red;};
	this.getGreen = function(){return this.green;};
	this.getBlue = function(){return this.blue;};
	this.getX = function(){return this.px;};
	this.getY = function(){return this.py;};
	this.getSize = function(){return this.asize;};
	this.getColor = function(alpha){
		var col = "rgba("+this.red+","+this.green+","+this.blue+","+alpha+")";
		return col;
	};
	this.setRed = function(r){this.red = r;};
	this.setGreen = function(g){ this.green = g;};
	this.setBlue = function(b){this.blue = b;};
	this.setX = function(x){ this.px = x;};
	this.setY = function(y){ this.py = y;};
	this.setSize = function(s){ this.asize = s;};
	this.setColor = function(r,g,b){
		this.red = r;this.green = g;this.blue = b;
	};
	this.getFoodIndex = function(){
		for(var i = 0;i<foodPool.length;i++){
			if((Math.abs((this.px-foodPool[i].x))<=collisionTolerance)&&(Math.abs(this.py-foodPool[i].y)<=collisionTolerance)){
				return i;
			}
		}
		return -1;
	}
	this.closeFoodIndex = -1;
	this.updateDirection = function(){
		var foodIndex = this.getFoodIndex();
		if(foodIndex>=0)
		{
			this.foodCtr +=1;
			console.log('got food at '+foodIndex+", "+foodPool[foodIndex]);
			randomizeFood(foodIndex);
		}
		var closeFood = this.closeFoodIndex;
		// if(this.closeFoodIndex<0){
		// 	closeFood = getClosestFood(this,foodPool);
		// }
		// else{
		// 	if(foodIndex == this.closeFoodIndex){
		// 	}
		// }
		closeFood = getClosestFood(this,foodPool);		
		var cfx = foodPool[closeFood].x-this.px;
		var cfy = foodPool[closeFood].y-this.py;
		var foodMag = Math.sqrt(Math.pow(cfx,2)+Math.pow(cfy,2));
		cfx = cfx/foodMag;
		cfy = cfy/foodMag;
		var res = this.neuralNet.getOutput([this.xdirection,this.ydirection,cfx,cfy]);
		// console.log(res);
		this.lforce = res[0];
		this.rforce = res[1];
		var newangle = this.rforce-this.lforce;
		newangle = clamp(newangle,-1*MaxRot,MaxRot);
		this.angle+=newangle;
		this.xdirection = Math.cos(this.angle);
		this.ydirection =  Math.sin(this.angle);
	};
	this.updatePosition = function(){
		this.updateDirection();
		var speed = (this.lforce+this.rforce);
		this.px = this.px + (speed*this.xdirection);
		this.py = this.py + (speed*this.ydirection);
		if(this.px<=0){this.px=mainCanvas.width;}
		else if(this.px>=mainCanvas.width){this.px=0;}
		if(this.py<=0){this.py=mainCanvas.height;}
		else if(this.py>=mainCanvas.height){this.py=0;}
	};
	this.getScore = function(){return this.foodCtr;};
	this.setScore = function(a){this.foodCtr = a;};
	this.reset = function(){
		this.setScore(0);
		// this.px = Math.random()*mainCanvas.width;
		// this.py = Math.random()*mainCanvas.height;
		// this.angle = Math.random()*2*Math.PI;
	};
	this.draw = function (mainCanvas){
					canvasContext = mainCanvas.getContext("2d");
					oldfillstyle = canvasContext.fillStyle;
					canvasContext.beginPath();
					var x = this.getX();
					var y = mainCanvas.height - this.getY();
					var radius = this.getSize();
					if(isglowing){		
						var gradient = canvasContext.createRadialGradient(x,y,0,x,y,radius+3);
						gradient.addColorStop(0,'#FFFFFF');
						gradient.addColorStop(1,this.getColor(1));
						canvasContext.fillStyle = gradient;
						canvasContext.arc(x,y,radius+4,0,2*Math.PI);
						canvasContext.fill();
					} 
					else{		
						canvasContext.fillStyle = this.getColor(1);
						canvasContext.arc(x,y,radius,0,2*Math.PI);
						canvasContext.fill();
					}
					canvasContext.closePath();
					canvasContext.fillStyle = oldfillstyle;
				};
}
function getClosestFood(ant,foodarr){
	var closestFoodDist = 22000;
	var antx = ant.getX();
	var anty = ant.getY();
	var cfoodIndex;
	for(var i=0;i<foodarr.length;i++){
		var temp = distance(antx,anty,foodarr[i].x,foodarr[i].y);
		if(temp<closestFoodDist){
			cfoodIndex = i;
			closestFoodDist = temp;
		}
	}
	return cfoodIndex;
}
function distance(x1,y1,x2,y2){
	return Math.sqrt(Math.pow(x1-x2,2)+Math.pow(y1-y2,2));
}
function randomizeFood(index){
	var bgCanvas = $('#bg-canvas')[0];
	foodPool[index].x = Math.random()*bgCanvas.width;
	foodPool[index].y = Math.random()*bgCanvas.height;
}
function drawAnts(mainCanvas){
	for(var i =0;i<antPool.length;i++){
		antPool[i].draw(mainCanvas);
	}
}
function updateAnts(){
	globalTicks +=1;
	var maxscore = 0;
	if(globalTicks>=epochTick){
		globalTicks = 0;
		if(!stopgenetic)
		{
			genetic.update();
			currGenNo++;
			$('#gen')[0].innerHTML = currGenNo;
			$('#best')[0].innerHTML = genetic.bestFitness+" by ant Num: "+genetic.generation[genetic.bestGeneomeIndex].antNum+" avg:"+genetic.avgFitness;
			// $('#bestholder')[0].innerHTML = genetic.generation[0].antNum;
			// $('#bestholder').css('color',antPool[0].getColor(1));
			if(clearall)
			{clearScreen('main-canvas');}
		}
	}
	var str="";
	for(var i =0;i<antPool.length;i++){
		antPool[i].updatePosition();
		str+="<span style=\"color:"+antPool[i].getColor(1)+"\">"+i+": "+antPool[i].getScore()+"</span><br>";
		// if(antPool[i].getScore()>maxscore){
		// 	maxant = i;
		// }		
	}
	$('#bestholder')[0].innerHTML = str;
}
function drawFood(bgCanvas){
	var mcontext = bgCanvas.getContext('2d');
	mcontext.clearRect(0,0,bgCanvas.width,bgCanvas.height);
	for(var i=0;i<foodPool.length;i++){
		foodPool[i].draw(bgCanvas);
	}
}
function beginAnimation(){
	if(!running){return;}
	var mainCanvasjQ = $('#main-canvas');
	mainCanvas = mainCanvasjQ[0];
	var mcontext = mainCanvas.getContext('2d');
	var bgCanvas = $('#bg-canvas')[0];
	if(!leaveTrail){
		mcontext.clearRect(0,0,mainCanvas.width,mainCanvas.height);
	}
	for(var i = 0;i<fastMode;i++){		
		updateAnts();
		drawFood(bgCanvas);
		drawAnts(mainCanvas);
	}
	window.requestAnimationFrame(beginAnimation);
}
function genes(){
	this.genome=[];
	this.antNum = 0;
	this.setGenome = function(abc){
		this.genome = abc;
	};
	this.getGenome = function(){
		return this.genome;
	};
	this.fitness;
	this.getFitness = function(){this.fitness = antPool[this.antNum].getScore();return antPool[this.antNum].getScore();};
	this.getVal = function(){this.fitness = antPool[this.antNum].getScore();return antPool[this.antNum].getScore();};
	this.equalGenome = function(g2){
		if(this.genome.length!=g2.genome.length){return false;}
		for(var i=0;i<this.genome.length;i++){
			if(this.genome[i]!=g2.genome[i]){
				return false;
			}
		}
		return true;
	};
}
function copy(geneobj){
	var temp = new genes();
	temp.antNum = geneobj.antNum;
	for(var i=0;i<geneobj.genome.length;i++){
		temp.genome[i] = geneobj.genome[i];		
	}
	temp.getFitness();
	return temp;
}
function geneticAlgo(){
	this.mutationRate = mutationRate;
	this.crossRate = crossRate;
	this.generation = [];
	this.totalFitness = 0;
	this.avgFitness = 0.0;
	this.bestFitness = 0;
	this.worstFitness = 0;
	this.bestGeneomeIndex = -1;
	this.allFitness = function(){
		var fitness = 0;
		var maxF = -1;
		var minF = 1000000;
		for(var i=0;i<antPool.length;i++){
			var temp = antPool[i].getScore();
			fitness+=temp
			if(temp>maxF){
				maxF = temp;
				this.bestGeneomeIndex = i;
			}
			if(temp<minF){
				minF = temp;
			}
		}
		this.totalFitness = fitness;
		this.bestFitness = maxF;
		this.worstFitness = minF;
		this.avgFitness = this.totalFitness/this.generation.length;
	};
	this.getBest = function(n){
		this.allFitness();
		if(this.generation.length==0){return [];}
		sort(this.generation);
		console.log("srted: ");
		console.log(this.generation);
		if(n>=this.generation.length){n=this.generation.length;}
		var res=[];
		for(var i=0;i<n;i++){
			res[i] = copy(this.generation[this.generation.length-1-i]);
		}console.log(res);
		return res;
	};
	this.picker = function(candidates){
		var pick = Math.floor(Math.random()*candidates.length);
		// return candidates[pick];
		var chance = Math.random()*this.totalFitness;
		var sofar = 0;
		var chosen = new genes();
		var chosenIndex = 0;
		for(var i=0;i<candidates.length;i++){
			sofar=candidates[i].getVal();
			if(sofar>=chance){
				chosenIndex = i;
				break;
			}
		}
		chosen.antNum = candidates[chosenIndex].antNum;
		for(var j=0;j<candidates[chosenIndex].genome.length;j++){
			chosen.genome[j] = candidates[chosenIndex].genome[j];
		}
		return chosen;
	};
	this.crossover = function(p1,p2){
		var crossed = [];
		crossed[0] = p1;
		crossed[1] = p2;
		if(p1.equalGenome(p2)){
			return crossed;
		}
		var chance = Math.random();
		if(chance<this.crossRate){
			var split =Math.floor(Math.random()*p1.genome.length);
			var ctr = 0;
			console.log("crossed from "+split);
			for(var i=split;i<p1.genome.length;i++){
				var temp = crossed[0].genome[i]; 
				crossed[0].genome[i] = crossed[1].genome[i-split];
				crossed[1].genome[i-split] = temp;
				// ctr++;
			}
		}
		return crossed;
	};
	this.mutate = function(geneObject){
		for(var i =0;i<geneObject.genome.length;i++){
			if(Math.random()<this.mutationRate){
				var sign = 1;
				if(Math.random()<0.5){sign = -1;}
				geneObject.genome[i]+=(Math.random()*sign*maxDistort);
			}
		}
		return geneObject;
	};
	this.update = function(){
		var newgen = this.getBest(pickNBest);
		console.log(newgen);
		$('#best').css('color',antPool[this.bestGeneomeIndex].getColor(1));
		while(newgen.length<this.generation.length)
		{
			var g1 = this.picker(this.generation);
			var g2 = this.picker(this.generation);
			console.log(g1);
			console.log(g2);

			var crossed = this.crossover(g1,g2);
			for(var i=0;i<crossed.length;i++){
				crossed[i] = this.mutate(crossed[i]);
				newgen[newgen.length] = crossed[i];
			}
			// console.log(crossed);
			// console.log(antPool[crossed[0].antNum].neuralNet.getWeightMatrix());
			// console.log(antPool[crossed[1].antNum].neuralNet.getWeightMatrix());
			// console.log(this.generation);
			// crossover
			// mutate
			// update ants
		}
		console.log(newgen);
		for(var i=0;i<antPool.length;i++){
			newgen[i].antNum = i;
			antPool[i].neuralNet.setWeightMatrix(newgen[i].getGenome());
			antPool[i].setScore(0);
		}	
		this.generation = newgen;	
	};
}
function sort(a){
	return  quicksort(a,0,a.length-1);
}
// console.log(sort([0,1,2,3,4,5]));
// console.log(sort([1,2,3,7,5,6,8]));
// console.log(sort([9,8,7,6,5,4,3,2]));
// console.log(sort([0,1]));
// console.log(sort([1,0]));
// console.log(sort([1,0,2]));
// console.log(sort([1,2,0]));
// console.log(sort([1,8,7,1,2,3,4]));
// console.log(sort([11,8,17,11,21,3,4]));
// console.log(sort([11,81,17,11,21,3,4]));
function quicksort(a,s,e){
	if(e<0){e=0;}
	if(s>e){s=e;}
	if((e-s)<=1){
		if(a[s].getVal()>a[e].getVal()){
			var temp = a[s];
			a[s] = a[e];
			a[e] = temp;
		}
	}
	else{
		var split = e;
		var lctr = s;
		var rctr = e;
		var key = a[split].getVal();
		while(lctr<=rctr){
			while(a[lctr].getVal()<=key){
				lctr++;
				if(lctr>=e){lctr=e;break;}
				if(lctr>rctr){break;}
			}
			while(a[rctr].getVal()>=key){
				rctr--;
				if(rctr<=0){rctr=0;break;}
				if(lctr>rctr){break;}
			}
			if(lctr==s && rctr==s){break;}
			if(lctr==e && rctr==e){break;}
			if(lctr>rctr){break;}
			var temp = a[lctr];
			a[lctr] = a[rctr];
			a[rctr] = temp;			

		}	
		var finalpos = rctr;
		if(split>rctr){
			finalpos = lctr;
		}
		var temp = a[finalpos];
		a[finalpos] = a[split];
		a[split] = temp;	
		quicksort(a,s,finalpos-1);
		quicksort(a,finalpos+1,e);	
	}
	return a;
}
function start(){
	if(running){return;}
	running = true;
	initAnts();
	initFood();
	window.requestAnimationFrame(beginAnimation);
}
function trainedstart(){
	if(running){return;}
	running = true;
	initAnts(true);
	initFood();
	window.requestAnimationFrame(beginAnimation);	
}
function initAnts(trained = false){
	if(antPool.length<numAnts){
		var mainCanvas = $('#main-canvas')[0];
		for(var i=0;i<numAnts;i++){
			var x = Math.random()*mainCanvas.width;
			var y = Math.random()*mainCanvas.height;
			var r = Math.round(Math.random()*255);
			var g = Math.round(Math.random()*255);
			var b = Math.round(Math.random()*255);
			var s = antSize;
			var ant = new Ant(x,y,r,g,b,s);
			antPool[i] = ant;
			if(trained && (trainedMatrix.length>0)){
				var chance = 0;
				stopgenetic = true;
				if(Math.random()<=0.5){chance=1;}
				// var tempwm = copyArray(trainedMatrix[chance]);
				antPool[i].neuralNet.setWeightMatrix(trainedMatrix[chance]);	
			}
		}
	}
	if(genetic==null){
		genetic = new geneticAlgo();
		for(var i=0;i<antPool.length;i++){
			var tempgene = new genes();
			tempgene.antNum = i;
			tempgene.setGenome(antPool[i].neuralNet.getWeightMatrix());
			tempgene.fitness = 0;//Math.random();
			genetic.generation[i] = tempgene;
		}
		console.log(antPool);
		console.log(genetic);
	}
}
function initFood(){
	if(foodPool.length<numFood){
		var mainCanvas = $('#main-canvas')[0];
		for(var i=0;i<numFood;i++){
			var x = Math.random()*mainCanvas.width;
			var y = Math.random()*mainCanvas.height;
			var food = new Food(x,y);
			foodPool[i] = food;
		}
	}
}
function pause(){
	console.log(globalTicks);
	running = false;
}
function toggleGlow(){
	isglowing = (!isglowing);
}
function toggleTrail(){
	leaveTrail = (!leaveTrail);
}
function clearScreen(canvasname){
	var mainCanvas = $('#'+canvasname)[0];
	var mcontext = mainCanvas.getContext("2d");
	mcontext.clearRect(0,0,mainCanvas.width,mainCanvas.height);
}
function getRgb(r,g,b,alpha){
	var col = "rgba("+r+","+g+","+b+","+alpha+")";
	return col;
}
function toggleFast(){
	fastMode += 10 ;
	if(fastMode>11){fastMode = 1;}
}
function incl(x){lspeed = parseFloat((lspeed+x*0.2).toPrecision(2));$('#ls').val(lspeed);}
function incr(x){rspeed = parseFloat((rspeed+x*0.2).toPrecision(2));$('#rs').val(rspeed);}
function copyArray(b){
	var res=[];
	for(var i=0;i<b;i++){
		res[i] = b[i];
	}
	return res;
}
function toggleGenetic(){
	stopgenetic = !stopgenetic;
	console.log(genetic.generation);
}
function clearEachGen(){
	clearall = !clearall;
}
trainedMatrix[0]=[1.693023036874149,
0.9584759005263968,
-0.38868386930198096,
2.9203930335383896,
-2.4108137748033536,
-1.124005564910301,
2.87631295939064,
0.1627976289414531,
2.187672616225698,
1.5111237969382665,
0.23721983381751155,
0.6541397358485528,
-1.5048623529509177,
-0.27624686633289053,
-1.560535833226321,
0.6696802932720787,
0.20980255752958676,
-0.806406589428672,
-3.5319329235391814,
-2.1625224371952645,
-0.7279356297413215,
0.9842752635661534,
-0.6648603491760605,
-3.3674152117955325,
0.010948184315935583,
-2.070594223229347,
-0.7550199907331867,
0.39660608376286155,
-0.9320624195219436,
0.5560838881016295,
-0.35658315958131404,
0.840191189988925,
1.7659149715482279,
-0.5793445765970527,
0.9774059307541956,
0.6902843264546303,
0.8312488304401899,
0.7219519143764361,
-0.8608582450757992,
-0.1310062025969645,
0.9352494145530701,
-1.927914133246494,
-0.6581777788983385,
0.7338762640836594,
1.9495417909723147,
-1.7928963791147452,
0.09125168273005246,
-0.4948468123814047,
2.2744138999608423,
-0.3784171626310928,
-0.4786154610784221];
trainedMatrix[1]=[-3.031425417026924,
-2.0779769627362628,
2.075824980530859,
-1.0213584557551498,
3.354153993592493,
6.408684670058693,
3.2078230895168396,
-0.38996298482772296,
-1.0748642890768365,
-0.21859954018811956,
1.5862745592155776,
3.828480021545259,
-0.9254663161711347,
-3.144886394580017,
-0.33585656935146924,
2.8010067851499505,
-0.7557630614545467,
-0.458255872022024,
-3.0359769164441452,
-2.791359768784166,
-2.9279465113255654,
-3.5216550905615827,
0.3159582607852094,
0.7524071677978956,
-1.199504194691123,
0.992303119822928,
3.1389288416422825,
1.8868946224234158,
-3.049936222582348,
1.0228077156905846,
0.609093545532952,
-4.165293644460996,
-3.085067853167244,
-0.7391396719527155,
0.9774059307541956,
-2.2765912749758983,
3.0788577694032098,
0.7219519143764361,
-3.5283856018365034,
-0.23702551472638345,
3.286581612268245,
0.609093545532952,
1.4903641545210626,
0.7338762640836594,
-0.8258547283327702,
-0.7863612020846009,
0.44520327952906014,
-0.4948468123814047,
2.2744138999608423,
-3.2873110725438672,
-0.4786154610784221];