! function() {
	var vis = {};
	var width = 50,
		height = 950,
		barmargin = 260,
		subMargin = 5,
		minHeight = 14;
	var colors = ["#3366CC", "#DC3912", "#FF9900", "#109618", "#990099", "#0099C6"];
	var mappedColor = {};

	vis.buildData = function(raw_data, method) {
		return buildStrutualData(raw_data, method);
	}

	function buildStrutualData(raw_data, method) {
		var structual_data = new Array();
		var groupMembers = buildGroupMembers(raw_data, method);
		structual_data.push(groupMembers);
		var groupProfile = buildGroupProfile(raw_data, method);
		structual_data.push(groupProfile);
		var neighbors = buildNeighbors(raw_data, method);
		structual_data.push(neighbors);
		var recs = buildRecs(raw_data);
		structual_data.push(recs);
		return structual_data;
	}

	function buildGroupMembers(raw_data, method) {
		var groupMembers = new Array();
		raw_data.members.forEach(function(_member, p) {
			var member = new Array();
			member[0] = _member.name;
			if(method == 'avg') {
				member[1] = 5;
			} else if(method == 'cs') {
				member[1] = _member.contribution;
			}
			member[2] = new Array(null);
			member[3] = _member.ratings;
			member[3].forEach(function(_item, item_index) {
				var key = _item[0];
				if(raw_data.items[key] != null) {
					raw_data.items[key].ratings[member[0]] = _item[1];
				} else {
					raw_data.items[key] = {};
					raw_data.items[key].name = key;
					raw_data.items[key].ratings = {};
					raw_data.items[key].ratings[member[0]] = _item[1];
				}
			});
			groupMembers.push(member);
		});
		return groupMembers;
	}

	function buildGroupProfile(raw_data, method) {
		var groupProfile = new Array();
		var items = new Array();
		for(var itemkey in raw_data.items) {
			var item = new Array();
			item[0] = itemkey;
			item[1] = 0;
			item[2] = new Array();
			for(var userkey in raw_data.items[itemkey].ratings) {
				var value = raw_data.items[itemkey].ratings[userkey];
				item[1] += value;
				item[2].push([userkey, value]);
			}
			item[3] = new Array();
			raw_data.neighbors.forEach(function(_neighbor, neighbor_index) {
				_neighbor.ratings.forEach(function(_item, _item_index) {
					if(_item[0] == itemkey) {
						item[3].push([_neighbor.name, 1]);
					}
				});
			});
			items.push(item);
		}
		var groupavg = 0;//the average rating of the group profile
		items.forEach(function(_item, item_index) {
			_item[1] = getGroupRating(_item[2], method);
			groupavg += _item[1];
			raw_data.items[_item[0]].groupRating = _item[1];
			groupProfile.push(_item);
		});
		raw_data.groupavg = groupavg/items.length;
		return groupProfile;
	}

	function buildNeighbors(raw_data, method) {
		var neighbors = new Array();
		raw_data.neighborinfo = {};
		raw_data.neighbors.forEach(function(_neighbor) {
			var neighbor = new Array();//entity for structual data
			//initial neighbor entiry
			neighbor[0] = _neighbor.name;
			neighbor[1] = sim;
			neighbor[2] = new Array();
			neighbor[3] = new Array();
			//compute sim between group profile and neighbor users
			var neighbor_avg = 0;
			var pairs = new Array();
			_neighbor.ratings.forEach(function(rating) {
				var itemkey = rating[0];
				neighbor_avg += rating[1];
				if(raw_data.items[itemkey] != null) {//item has been rated by members
					pairs.push([raw_data.items[itemkey].groupRating, rating[1]]);
				} else {//item is new
					neighbor[3].push([itemkey, rating[1]]);
					if(raw_data.recs[itemkey] == null) {
						raw_data.recs[itemkey] = {};
						raw_data.recs[itemkey].name = itemkey;
						raw_data.recs[itemkey].ratings = new Array();
						raw_data.recs[itemkey].ratings.push([_neighbor.name, rating[1]]);
					} else {
						raw_data.recs[itemkey].ratings.push([_neighbor.name, rating[1]]);
					}
				}
			})
			neighbor_avg /= _neighbor.ratings.length;
			var sum1 = 0;
			var sum2 = 0;
			var avg1 = 0;
			var avg2 = 0;
			var div1 = new Array();
			var div2 = new Array();
			pairs.forEach(function(pair, pair_index) {
				sum1 += pair[0];
				sum2 += pair[1];
			});
			avg1 /= sum1 / pairs.length;
			avg2 /= sum2 / pairs.length;
			sum1 = 0;
			sum2 = 0;
			var sum3 = 0;
			pairs.forEach(function(pair, pair_index) {
				div1.push(pair[0] - avg1);
				div2.push(pair[1] - avg2);
				sum1 += div1[pair_index] * div1[pair_index];
				sum2 += div2[pair_index] * div2[pair_index];
				sum3 += div1[pair_index] * div2[pair_index];
			});
			var sim = sum3 / Math.sqrt(sum1 * sum2);
			neighbor[1] = sim;
			_neighbor.sim = sim;//update neighbor entity in raw_data
			raw_data.neighborinfo[_neighbor.name] = {};//insert sim-dictionary entity to raw_data
			raw_data.neighborinfo[_neighbor.name].sim = sim;
			raw_data.neighborinfo[_neighbor.name].avg = neighbor_avg;
			_neighbor.ratings.forEach(function(rating, rating_index) {
				if(raw_data.items[rating[0]] != null) {
					neighbor[2].push([rating[0], div1[rating_index] * div2[rating_index] / Math.sqrt(sum1 * sum2)]);
				}
			});
			neighbors.push(neighbor);
		});
		return neighbors;
	}

	function getGroupRating(ratings, method) {
		var groupRating = 0;
		if(method == "avg") {
			ratings.forEach(function(rating) {
				groupRating += rating[1];
			});
			return groupRating / ratings.length;
		} else if(method == "lm") {
			groupRating = 10000.0;
			for(var userkey in ratings) {
				if(ratings[userkey] < groupRating)
					groupRating = ratings[userkey];
			}
			return groupRating;
		}
		return groupRating;
	}

	function buildRecs(raw_data) {
		var recs = new Array();
		for(var itemkey in raw_data.recs){
			var rec = new Array();//recommendation entity for structual data
			//entity initiation
			rec[0] = itemkey;
			rec[1] = 0;
			rec[2] = new Array();
			rec[3] = new Array(null);
			var sum_sim = 0;
			var sum_rating = 0;
			raw_data.recs[itemkey].ratings.forEach(function(_rating,rating_index){
				var pvalue = (_rating[1]-raw_data.neighborinfo[_rating[0]].avg)*raw_data.neighborinfo[_rating[0]].sim;
				alert(pvalue);
				rec[1] += pvalue;
				sum_sim += Math.abs(raw_data.neighborinfo[_rating[0]].sim);
				rec[2].push([_rating[0],Math.random()]);
			});
			rec[1] /= sum_sim;
			rec[1] += raw_data.groupavg
			recs.push(rec);
		}
		return recs;
	}

	//build visual data (objects) from structual data
	function mappingColors(key, index) {
		var mc = {};
		mappedColor[key] = colors[index % colors.length];
	}

	vis.getStructureData = function(rdata) {
		var sData = new Array();
		sData.data = new Array();
		sData.bars = new Array();

		rdata.forEach(function(data, p) {
			sData.bars[p] = new Array();
			data.forEach(function(d, dp) {
				var sd = new Array();
				sd.key = d[0];
				sd.value = d[1];
				sd.left_links = d[2];
				sd.right_links = d[3];
				sd.groups = new Array();
				group = new Array();
				sd.left_links.forEach(function(link, lp) {
					if(link == null) {
						if(group[sd.key] == null) {
							group[sd.key] = new Array();
						}
						group[sd.key].push([sd.key, sd.value]);
						mappingColors(sd.key, dp);
					} else {
						sData.data[link[0]].groups.forEach(function(gg) {
							if(group[gg.key] == null) {
								group[gg.key] = new Array();
							}
							group[gg.key].push(link);
						});
					}
				});
				for(var rootkey in group) {
					var g = {};
					g.key = rootkey;
					g.value = 0;
					group[rootkey].forEach(function(d) {
						g.value += d[1];
					});
					sd.groups.push(g);
				}
				sData.data[sd.key] = sd;
				sData.bars[p].push(sd.key);
			});
		});
		return sData;
	}

	//construct data for d3 diagram
	function getVisData(sData) {
		var visData = {};

		function getCirlces(bar, barwidth, barmargin, buffMargin, minr, maxr, p) {
			var circles = [];
			var maxvalue = -999.0;
			bar.forEach(function(entitykey, ep) {
				if(sData.data[entitykey].value > maxvalue)
					maxvalue = sData.data[entitykey].value;
			});
			y = 0;
			bar.forEach(function(entitykey, ep) {
				entity = sData.data[entitykey];
				var circle = {};
				r = entity.value / maxvalue * maxr;
				circle.cx = p * (barwidth + barmargin) + barwidth / 2.0;
				//circle.cy = y + r + buffMargin;
				circle.cy = height * (2 * ep + 1) / (2 * bar.length);
				circle.r = r > minr ? r : minr;
				circle.key = entity.key;
				y = circle.cy + maxr + buffMargin;
				circles.push(circle);
				visData.keys[entitykey] = circle;
				getEdges(entity, circle, barwidth, barmargin, p);

				getPies(entity, circle, barwidth, barmargin, p);
			});
			return circles;
		}

		function getEdges(entity, circle, barwidth, barmargin, p) {
			var edges = [];
			entity.left_links.forEach(function(link) {
				if(link != null) {
					var edge = {};
					targetkey = link[0];
					targetCircle = visData.keys[targetkey];
					edge.x1 = circle.cx - circle.r * 0.7;
					edge.y1 = circle.cy;
					edge.x2 = targetCircle.cx + targetCircle.r * 0.7;
					edge.y2 = targetCircle.cy;
					edge.width = link[1] * 5;
					visData.edges.push(edge);
				}
			});
		}

		function getPies(entity, circle, barwidth, barmargin, p) {
			var pie = {};
			pie.key = entity.key;
			pie.data = entity.groups;
			pie.x = circle.cx;
			pie.y = circle.cy;
			pie.r = circle.r;
			visData.pies.push(pie);
		}

		visData.keys = new Array();
		visData.circles = new Array();
		visData.edges = new Array();
		visData.pies = new Array();

		sData.bars.forEach(function(bar, bp) {
			visData.circles.push(getCirlces(bar, width, barmargin, subMargin, 10, 30, bp));
		});

		return visData;
	}

	function drawMainBars(visData, svg) {
		visData.circles.forEach(function(bars, p) {
			svg.append("g").attr("class", "bar" + p);
			svg.select(".bar" + p).append("g").attr("class", "mainbars");
			var mainbar = svg.select(".bar" + p).select(".mainbars")
				.selectAll(".mainbar").data(bars)
				.enter().append("g").attr("class", "mainbar");

			mainbar.append("circle").attr("class", "mainrect")
				.attr("cx", function(d) {
					return d.cx
				})
				.attr("cy", function(d) {
					return d.cy
				})
				.attr("r", function(d) {
					return d.r
				})
				.style("shape-rendering", "auto")
				.style("stroke", "black")
				.style("stroke-width", "2.5")
				.style("stroke-opacity", 0.7);

			mainbar.append("text")
				.attr("x", (width + barmargin) * p + width + 10)
				.attr("y", function(d) {
					return d.cy + 8;
				})
				.text(function(d) {
					return d.key;
				})
				.style("text-anchor", "start")
				.style("font-family", "sans-serif")
				.style("font-size", "18");
		});
	}

	function drawEdges(visData, svg) {
		var edge = svg.selectAll(".edge").data(visData.edges)
			.enter().append("g").attr("class", "edge");

		edge.append("path")
			.attr("d", function(data, r) {
				//d = "M" + data.x1 + "," + data.y1 + "L" + data.x2 + "," + data.y2;
				factor = 0;
				if(Math.abs(data.y1 - data.y2) < 2) {
					factor = 0;
				} else {
					factor = 0.6;
				}
				dy = (data.y1 + data.y2) / 2.0 + (factor * (data.y1 - data.y2));
				//d = "M" + data.x1 + "," + data.y1 + "S" +(data.x1+data.x2)/2.0 +"," +dy + " " +data.x2 + "," + data.y2;
				d = "M" + data.x1 + "," + data.y1 + "L" + data.x2 + "," + data.y2;
				return d;
			})
			.style("stroke", "gray")
			.style("stroke-opacity", 0.5)
			.style("stroke-width", function(d) {
				return d.width;
			})
			.style("fill", "none");
	}

	function drawPies(visData, svg) {
		visData.pies.forEach(function(pie, pp) {
			var arc = d3.svg.arc()
				.outerRadius(pie.r)
				.innerRadius(0);

			var piem = d3.layout.pie()
				.sort(null)
				.value(function(d) {
					return d.value;
				});

			var g = svg.selectAll(".arc" + pp)
				.data(piem(pie.data))
				.enter().append("g")
				.attr("class", "arc" + pp);

			var slice = g.append("path")
				.attr("d", arc)
				.style("fill", function(value) {
					return mappedColor[value.data.key];
				})
				.attr("transform", "translate(" + pie.x + "," + pie.y + ")");
			slice.append("text")
				.attr("transform", function(value) { //set the label's origin to the center of the arc
					//we have to make sure to set these before calling arc.centroid
					value.outerRadius = pie.r + 50; // Set Outer Coordinate
					value.innerRadius = pie.r + 45; // Set Inner Coordinate
					return "translate(" + arc.centroid(value) + ")";
				})
				.attr("text-anchor", "middle") //center the text on it's origin
				.style("fill", "black")
				.style("font", "bold 9px Arial")
				.text(function(value, i) {
					return value.data.key;
				});

		});
	}

	headers = ["Group Members", "Group Profile", "Neighbor", "Recommendations"];

	function drawHeaders(headers, svg) {
		headers.forEach(function(header, p) {
			svg.select(".bar" + p)
				.append("text")
				.attr("x", (barmargin + width) * p + width / 2.0)
				.attr("y", function(d) {
					return -10;
				})
				.text(function(d) {
					return header;
				})
				.style("text-anchor", "middle")
				.style("font-family", "sans-serif")
				.style("font-size", "24");
		});
	}

	vis.draw = function(data, svg) {
		visData = getVisData(data);

		drawEdges(visData, svg);
		drawMainBars(visData, svg);
		drawPies(visData, svg);
		drawHeaders(headers, svg);
	}
	this.vis = vis;
}();