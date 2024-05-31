function createBubbleChart(error, countries, continentNames) {
  var populations = countries.map(function(country) { return +country.Population; });
  var meanPopulation = d3.mean(populations),
      populationExtent = d3.extent(populations),
      populationScaleX,
      populationScaleY;

  var continents = d3.set(countries.map(function(country) { return country.ContinentCode; }));
  var colorBlindFriendlyColors = [
    "#1f77b4", // 淡蓝色
    "#ff7f0e", // 橙色
    "#2ca02c", // 绿色
    "#9467bd", // 紫色
    "#17becf", // 蓝绿色
    "#e377c2"  // 粉红色
];

// 获取搜索框和国家列表的引用
var searchInput = document.getElementById("search-input");
var countryList = document.getElementById("country-list"); 
var continentColorScale = d3.scaleOrdinal()
.domain(continents.values())
.range(colorBlindFriendlyColors);

  var width = 1200,
      height = 800;
  var svg,
      circles,
      circleSize = { min: 10, max: 80 };
  //Define the scale for circle radius based on population
  var circleRadiusScale = d3.scaleSqrt()
      .domain(populationExtent)
      .range([circleSize.min, circleSize.max]);

  var forces,
      forceSimulation;
  
  var fisheyeEnabled = false;

  var bar_svg,
	  bar;

  var fisheye = d3.fisheye.circular().radius(200).distortion(2);

  document.getElementById("fisheye-toggle").addEventListener("change", function() {
    fisheyeEnabled = this.checked;
    updateFisheye();
  });

  createSVG();
  toggleContinentKey(!flagFill());
  createCircles();
  createForces();
  createForceSimulation();
  addFlagDefinitions();
  addFillListener();
  addGroupingListeners();
  clear_select();
// 监听搜索框输入事件
searchInput.addEventListener("input", function() {
  var searchTerm = this.value.trim().toLowerCase(); // 获取搜索关键词并转换为小写
  updateCountryList(searchTerm); // 更新国家列表
});

// 更新国家列表
function updateCountryList(searchTerm) {
  // 清空国家列表
  countryList.innerHTML = "";

  // 如果搜索关键词为空，则显示所有国家
  if (searchTerm === "") {
    countries.forEach(function(country) {
      appendCountryToList(country); // 将每个国家添加到列表中
    });
  } else {
    // 否则，筛选符合搜索条件的国家并显示
    var filteredCountries = countries.filter(function(country) {
      return country.CountryName.toLowerCase().includes(searchTerm);
    });
    filteredCountries.forEach(function(country) {
      appendCountryToList(country); // 将每个符合条件的国家添加到列表中
    });
  }
}

// 将国家添加到列表中
function appendCountryToList(country) {
  var countryItem = document.createElement("div");
  countryItem.textContent = country.CountryName;
  countryItem.style.color = continentColorScale(country.ContinentCode); // 设置国家名称颜色
  countryItem.addEventListener("click", function() {
    highlightCountry(country); // 点击国家名称时高亮对应的气泡图
    showCountryDetails(country); // 显示国家信息
  });
  countryList.appendChild(countryItem);
}
// 显示国家信息
function showCountryDetails(country) {
  var countryDetails = document.getElementById("country-info-details");
  var detailsHTML = "<h2>" + country.CountryName + "</h2>";
  detailsHTML += "<p>Population: " + d3.format(",")(country.Population) + "</p>";
  detailsHTML += "<p>Continent: " + continentNames[country.ContinentCode] + "</p>";
  // 添加更多你想要显示的国家信息...
  countryDetails.innerHTML = detailsHTML;
}
// 高亮对应的气泡图
function highlightCountry(country) {
  // 重置所有圆圈的透明度
  circles.attr("opacity", 0.4);
  // 找到对应国家的圆圈并将其透明度设置为1
  circles.filter(function(d) {
    return d.CountryName === country.CountryName;
  }).attr("opacity", 1);

}

// 页面加载时更新国家列表
updateCountryList("");
  function createSVG() {
    svg = d3.select("#bubble-chart")
      .append("svg")
        .attr("width", width)
        .attr("height", height)
        .on("mousemove",null);
  }

  function updateFisheye() {
    if (fisheyeEnabled) {
      svg.on("mousemove", function() {
        fisheye.focus(d3.mouse(this));
        forceSimulation.alpha(0.5).restart();
      });
    } else {
      svg.on("mousemove", null);
    }
  }
  function toggleContinentKey(showContinentKey) {
    var keyElementWidth = 150,
        keyElementHeight = 30;
    var onScreenYOffset = keyElementHeight*1.5,
        offScreenYOffset = 100;

    if (d3.select(".continent-key").empty()) {
      createContinentKey();
    }
    var continentKey = d3.select(".continent-key");

    if (showContinentKey) {
      translateContinentKey("translate(0," + (height - onScreenYOffset) + ")");
    } else {
      translateContinentKey("translate(0," + (height + offScreenYOffset) + ")");
    }

    function createContinentKey() {
      var keyWidth = keyElementWidth * continents.values().length;
      var continentKeyScale = d3.scaleBand()
        .domain(continents.values())
        .range([(width - keyWidth) / 2, (width + keyWidth) / 2]);

      svg.append("g")
        .attr("class", "continent-key")
        .attr("transform", "translate(0," + (height + offScreenYOffset) + ")")
        .selectAll("g")
        .data(continents.values())
        .enter()
          .append("g")
            .attr("class", "continent-key-element");

      d3.selectAll("g.continent-key-element")
        .append("rect")
          .attr("width", keyElementWidth)
          .attr("height", keyElementHeight)
          .attr("x", function(d) { return continentKeyScale(d); })
          .attr("fill", function(d) { return continentColorScale(d); });

      d3.selectAll("g.continent-key-element")
        .append("text")
          .attr("text-anchor", "middle")
          .attr("x", function(d) { return continentKeyScale(d) + keyElementWidth/2; })
          .text(function(d) { return continentNames[d]; });

      // The text BBox has non-zero values only after rendering
      d3.selectAll("g.continent-key-element text")
          .attr("y", function(d) {
            var textHeight = this.getBBox().height;
            // The BBox.height property includes some extra height we need to remove
            var unneededTextHeight = 4;
            return ((keyElementHeight + textHeight) / 2) - unneededTextHeight;
          });
    }

    function translateContinentKey(translation) {
      continentKey
        .transition()
        .duration(500)
        .attr("transform", translation);
    }
  }

  function flagFill() {
    return isChecked("#flags");
  }

  function isChecked(elementID) {
    return d3.select(elementID).property("checked");
  }

// 创建气泡图
function createCircles() {
  var formatPopulation = d3.format(",");
  circles = svg.selectAll("circle")
    .data(countries)
    .enter()
      .append("circle")
      .attr("r", function(d) { return circleRadiusScale(d.Population); })
      .attr("opacity", 0.6) // 设置初始透明度
      .on("mouseover", function(d) {
        d3.select(this).attr("opacity", 1); // 鼠标悬停时降低透明度
        updateCountryInfo(d, d); // 更新左上角气泡图内悬停时的数据显示和右下角搜索框下的数据显示
      })
      .on("mouseout", function(d) {
        // 鼠标移出时恢复透明度
        // 如果当前气泡不是选中状态，则恢复初始透明度
        if (!d3.select(this).classed("selected")) {
          d3.select(this).attr("opacity", 0.4);
        }
        updateCountryInfo(null, null); // 清空左上角气泡图内悬停时的数据显示和右下角搜索框下的数据显示
      })
      .on("click", function(d) {
        // 切换选中状态
        var isSelected = d3.select(this).classed("selected");
        d3.select(this).classed("selected", !isSelected);
        // 根据选中状态设置透明度
        d3.select(this).attr("opacity", isSelected ? 0.4 : 1);
        // 如果是选中状态，则执行相应操作，比如添加到图表中
        if (!isSelected) {
          add_country(d);
          create_Bar();
        } else {
          // 如果取消选中状态，则执行相应操作，比如从图表中移除
          // 这里可以根据需要添加相应的操作
        }
      });
}
// 切换气泡的选中状态
function toggleSelection(d, element) {
  var selected = d3.select(element).attr("selected") === "true";
  d3.select(element).attr("selected", !selected); // 切换 selected 属性的值
  // 根据选中状态设置样式
  if (!selected) {
    // 如果未选中，添加选中样式
    d3.select(element).attr("opacity", 1);
    // 这里可以执行其他选中后的操作
  } else {
    // 如果已选中，恢复初始样式
    d3.select(element).attr("opacity", 0.6);
    // 这里可以执行取消选中后的操作
  }
}
var graphData = [];
var barsvg;
function add_country(d){
	graphData.push({name:d.CountryName, value:d.Population});
}

function create_Bar(){
	d3.select("#country-bar").selectAll("svg").remove();
	bar_svg = d3.select("#country-bar").append("svg")
	.attr("width", 650)
	.attr("height", 420);
	const width = 650;
	const height = 420;
	const paddingTop = 60;
	const paddingBottom = 98;
	const paddingLeft = 90;
	const paddingRight = 24;
	const rectWidth = 40;
	const decoRectWidth = 2;
	const delay = 0;
	const duration = 2000;
	const max = Math.max(...graphData.map((item) => item.value));
	const xData = graphData.map((item) => item.name); // 对接数据时根据name名创建
	const xScale = d3.scaleBand()
	    .domain(xData)
	    .rangeRound([0, width - paddingLeft - paddingRight])
	const yScale = d3.scaleLinear()
	    .domain([0, max * 1.5])
	    .range([height - paddingTop - paddingBottom, 0]);
	
	// 定义X坐标轴
	const xAxis = d3.axisBottom(xScale)
	   .ticks(0)
	   .tickPadding(12);
	// 定义Y坐标轴
	const yAxis = d3.axisLeft(yScale)
	   .ticks(5)
	   .tickPadding(8)
	   .tickFormat(d3.format('d'));
	// 添加
	bar_svg.append('g')
	   .attr('class', 'r-xAxis')
	   .attr('transform', `translate(${paddingLeft},${height - paddingBottom})`)
	   .call(xAxis);
	bar_svg.append('g')
	   .attr('class', 'r-yAxis')
	   .attr('transform', `translate(${paddingLeft},${paddingTop})`)
	   .call(yAxis);
	   
	yScale.range([0, height - paddingTop - paddingBottom]);
	
	const rectGroup = bar_svg.selectAll('.rectItem')
	  .data(graphData)
	  .enter()
	  .append('g')
	  .attr('class', 'rectItem');
	rectGroup.append('rect')
	  .attr('width', rectWidth)
	  .attr('height', 0)
	  .attr('y',height - paddingTop - paddingBottom)
	  .attr('fill', 'url(#rbGraphsColor)')
	  .attr('transform', `translate(${paddingLeft},${paddingTop})`)
	  .attr('x', (d) => xScale(d.name) + ((xScale.bandwidth() - rectWidth) / 2))
	  .transition()
	  .delay(delay)
	  .duration(duration)
	  .attr('height', (d) => yScale(d.value))
	  .attr('y', (d) => height - paddingTop - paddingBottom - yScale(d.value))
	  
	rectGroup.append('rect')
		.attr('width', decoRectWidth)
	    .attr('height', 0)
	    .attr('y',height - paddingTop - paddingBottom)
	    .attr('fill', '30ca6e')
		.attr('opacity', 0.6)	
	    .attr('transform', `translate(${paddingLeft},${paddingTop})`)
	    .attr('x', (d) => xScale(d.name) + ((xScale.bandwidth() - rectWidth) / 2))
	    .transition()
	    .delay(delay)
	    .duration(duration)
	    .attr('height', (d) => yScale(d.value))
	    .attr('y', (d) => height - paddingTop - paddingBottom - yScale(d.value))
	
	rectGroup.append('rect')
		.attr('width', rectWidth)
	    .attr('height', 2)
	    .attr('y',height - paddingTop - paddingBottom - 4)
	    .attr('fill', '32dd77')	
	    .attr('transform', `translate(${paddingLeft},${paddingTop})`)
	    .attr('x', (d) => xScale(d.name) + ((xScale.bandwidth() - rectWidth) / 2))
	    .transition()
	    .delay(delay)
	    .duration(duration)
	    .attr('y', (d) => height - paddingTop - paddingBottom - yScale(d.value))

}

// 清除气泡选中
function clear_select(){
	d3.select("#clear_select").on("click",function(){
		circles
		.attr("opacity", 0.4)
		.on("mouseout", function(d){
			d3.select(this).attr("opacity", 0.4);
			updateCountryInfo(null, null);
		});
		graphData = [];
		create_Bar();
		
	});
	
	
}

// 监听搜索框输入事件
searchInput.addEventListener("input", function() {
  var searchTerm = this.value.trim().toLowerCase(); // 获取搜索关键词并转换为小写
  var filteredCountries = countries.filter(function(country) {
    return country.CountryName.toLowerCase().includes(searchTerm);
  });
  // 如果只有一个国家匹配搜索条件，则更新右下角搜索框下的数据显示
  if (filteredCountries.length === 1) {
    updateCountryInfo(null, filteredCountries[0]);
  } else {
    updateCountryInfo(null, null); // 否则清空右下角搜索框下的数据显示
  }
});
    updateCircles();
  
// 更新左上角气泡图内悬停时的数据显示和右下角搜索框下的数据显示
function updateCountryInfo(topLeftInfo, bottomRightInfo) {
  // 更新左上角气泡图内悬停时的数据显示
  var topLeft = "";
  if (topLeftInfo) {
    topLeft = "<h2>" + topLeftInfo.CountryName + "</h2>";
    topLeft += "<p>Population: " + d3.format(",")(topLeftInfo.Population) + "</p>";
    topLeft += "<p>Continent: " + continentNames[topLeftInfo.ContinentCode] + "</p>";
    // 添加更多你想要显示的国家信息...
  }
  d3.select("#country-info").html(topLeft);

  // 更新右下角搜索框下的数据显示
  var bottomRight = "";
  if (bottomRightInfo) {
    bottomRight = "<h2>" + bottomRightInfo.CountryName + "</h2>";
    bottomRight += "<p>Population: " + d3.format(",")(bottomRightInfo.Population) + "</p>";
    bottomRight += "<p>Continent: " + continentNames[bottomRightInfo.ContinentCode] + "</p>";
    // 添加更多你想要显示的国家信息...
  }
  d3.select("#country-info-details").html(bottomRight);
}
  

  function updateCircles() {
    circles
      .attr("fill", function(d) {
        return flagFill() ? "url(#" + d.CountryCode + ")" : continentColorScale(d.ContinentCode);
      })
      .attr("opacity", 0.4); // 设置圆圈透明度
  }

  function createForces() {
    var forceStrength = 0.05;

    forces = {
      combine:        createCombineForces(),
      countryCenters: createCountryCenterForces(),
      continent:      createContinentForces(),
      population:     createPopulationForces()
    };

    function createCombineForces() {
      return {
        x: d3.forceX(width / 2).strength(forceStrength),
        y: d3.forceY(height / 2).strength(forceStrength)
      };
    }

    function createCountryCenterForces() {
      var projectionStretchY = 0.25,
          projectionMargin = circleSize.max,
          projection = d3.geoEquirectangular()
            .scale((width / 2 - projectionMargin) / Math.PI)
            .translate([width / 2, height * (1 - projectionStretchY) / 2]);

      return {
        x: d3.forceX(function(d) {
            return projection([d.CenterLongitude, d.CenterLatitude])[0];
          }).strength(forceStrength),
        y: d3.forceY(function(d) {
            return projection([d.CenterLongitude, d.CenterLatitude])[1] * (1 + projectionStretchY);
          }).strength(forceStrength)
      };
    }

    function createContinentForces() {
      return {
        x: d3.forceX(continentForceX).strength(forceStrength),
        y: d3.forceY(continentForceY).strength(forceStrength)
      };

      function continentForceX(d) {
        if (d.ContinentCode === "EU") {
          return left(width);
        } else if (d.ContinentCode === "AF") {
          return left(width);
        } else if (d.ContinentCode === "AS") {
          return right(width);
        } else if (d.ContinentCode === "NA" || d.ContinentCode === "SA") {
          return right(width);
        }
        return center(width);
      }

      function continentForceY(d) {
        if (d.ContinentCode === "EU") {
          return top(height);
        } else if (d.ContinentCode === "AF") {
          return bottom(height);
        } else if (d.ContinentCode === "AS") {
          return top(height);
        } else if (d.ContinentCode === "NA" || d.ContinentCode === "SA") {
          return bottom(height);
        }
        return center(height);
      }

      function left(dimension) { return dimension / 4; }
      function center(dimension) { return dimension / 2; }
      function right(dimension) { return dimension / 4 * 3; }
      function top(dimension) { return dimension / 4; }
      function bottom(dimension) { return dimension / 4 * 3; }
    }

    function createPopulationForces() {
      var continentNamesDomain = continents.values().map(function(continentCode) {
        return continentNames[continentCode];
      });
      var scaledPopulationMargin = circleSize.max;

      populationScaleX = d3.scaleBand()
        .domain(continentNamesDomain)
        .range([scaledPopulationMargin, width - scaledPopulationMargin*2]);
      populationScaleY = d3.scaleLog()
        .domain(populationExtent)
        .range([height - scaledPopulationMargin, scaledPopulationMargin*2]);

      var centerCirclesInScaleBandOffset = populationScaleX.bandwidth() / 2;
      return {
        x: d3.forceX(function(d) {
            return populationScaleX(continentNames[d.ContinentCode]) + centerCirclesInScaleBandOffset;
          }).strength(forceStrength),
        y: d3.forceY(function(d) {
          return populationScaleY(d.Population);
        }).strength(forceStrength)
      };
    }

  }

  function createForceSimulation() {
    forceSimulation = d3.forceSimulation()
      .force("x", forces.combine.x)
      .force("y", forces.combine.y)
      .force("collide", d3.forceCollide(forceCollide));
    forceSimulation.nodes(countries)
      .on("tick", function() {
        circles
          .each(function(d) { d.fisheye = fisheye({ x: d.x, y: d.y }); })
          .attr("cx", function(d) { return d.fisheye.x; })
          .attr("cy", function(d) { return d.fisheye.y; });
      });
  }

  function forceCollide(d) {
    return countryCenterGrouping() || populationGrouping() ? 0 : circleRadiusScale(d.Population) + 1;
  }

  function countryCenterGrouping() {
    return isChecked("#country-centers");
  }

  function populationGrouping() {
    return isChecked("#population");
  }

  function addFlagDefinitions() {
    var defs = svg.append("defs");
    defs.selectAll(".flag")
      .data(countries)
      .enter()
        .append("pattern")
        .attr("id", function(d) { return d.CountryCode; })
        .attr("class", "flag")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("patternContentUnits", "objectBoundingBox")
          .append("image")
          .attr("width", 1)
          .attr("height", 1)
          .attr("preserveAspectRatio", "xMidYMid slice")
          .attr("xlink:href", function(d) {
            return "flags/" + d.CountryCode + ".svg";
          });
  }

  function addFillListener() {
    d3.selectAll('input[name="fill"]')
      .on("change", function() {
        toggleContinentKey(!flagFill() && !populationGrouping());
        updateCircles();
      });
  }

  function addGroupingListeners() {
    addListener("#combine",         forces.combine);
    addListener("#country-centers", forces.countryCenters);
    addListener("#continents",      forces.continent);
    addListener("#population",      forces.population);

    function addListener(selector, forces) {
      d3.select(selector).on("click", function() {
        updateForces(forces);
        toggleContinentKey(!flagFill() && !populationGrouping());
        togglePopulationAxes(populationGrouping());
      });
    }

    function updateForces(forces) {
      forceSimulation
        .force("x", forces.x)
        .force("y", forces.y)
        .force("collide", d3.forceCollide(forceCollide))
        .alphaTarget(0.5)
        .restart();
    }

    function togglePopulationAxes(showAxes) {
      var onScreenXOffset = 40,
          offScreenXOffset = -40;
      var onScreenYOffset = 40,
          offScreenYOffset = 100;

      if (d3.select(".x-axis").empty()) {
        createAxes();
      }
      var xAxis = d3.select(".x-axis"),
          yAxis = d3.select(".y-axis");

      if (showAxes) {
        translateAxis(xAxis, "translate(0," + (height - onScreenYOffset) + ")");
        translateAxis(yAxis, "translate(" + onScreenXOffset + ",0)");
      } else {
        translateAxis(xAxis, "translate(0," + (height + offScreenYOffset) + ")");
        translateAxis(yAxis, "translate(" + offScreenXOffset + ",0)");
      }

      function createAxes() {
        var numberOfTicks = 10,
            tickFormat = ".0s";

        var xAxis = d3.axisBottom(populationScaleX)
          .ticks(numberOfTicks, tickFormat);

        svg.append("g")
          .attr("class", "x-axis")
          .attr("transform", "translate(0," + (height + offScreenYOffset) + ")")
          .call(xAxis)
          .selectAll(".tick text")
            .attr("font-size", "16px");

        var yAxis = d3.axisLeft(populationScaleY)
          .ticks(numberOfTicks, tickFormat);
        svg.append("g")
          .attr("class", "y-axis")
          .attr("transform", "translate(" + offScreenXOffset + ",0)")
          .call(yAxis);
      }

      function translateAxis(axis, translation) {
        axis
          .transition()
          .duration(500)
          .attr("transform", translation);
      }
	  
	  
    }
  }
}

