vde.App.controller('GroupsListCtrl', function($scope, $rootScope, $timeout, logger, $window, timeline) {
  $scope.gMdl = { // General catch-all model for scoping
    pipelines: vde.Vis.pipelines,
    editVis: false,
    sortableOpts: {
      update: function(e, ui) { $timeout(function() { vde.Vis.parse(); }, 1); },
      axis: 'y'
    },
    fonts: ['Helvetica', 'Verdana', 'Georgia', 'Palatino', 'Garamond', 'Trebuchet MS'],
    interpolation: ['linear', 'step-before', 'step-after', 'basis', 'basis-open', 'cardinal', 'cardinal-open', 'monotone']
  };

  $rootScope.groupOrder = vde.Vis.groupOrder;

  $rootScope.reparse = function() { vde.Vis.parse(); };

  $rootScope.toggleVisual = function(v, key, show) {
    if($rootScope.activeVisual == v && !show) {
      $rootScope.activeVisual = null;
      vde.iVis.activeMark = null;
    } else {
      $rootScope.activeVisual = v;

      var group = v.type == 'group' ? v : v.group();
      if(group.isLayer()) {
        $rootScope.activeGroup = group;
        $rootScope.activeLayer = group;
      } else {
        $rootScope.activeGroup = group;
        $rootScope.activeLayer = group.group();
      }

      $rootScope.activePipeline = v.pipelineName ? v.pipeline() : $rootScope.activePipeline;
      $scope.gMdl.activeVisualPipeline = (v.pipeline() || {}).name;

      vde.iVis.activeMark = v;
      vde.iVis.activeItem = key || 0;
    }

    vde.iVis.show('selected');

    logger.log('toggle_visual', {
      activeVisual: v.name,
      activeLayer: v.layerName || v.name,
      visualPipeline: v.pipelineName,
      activePipeline: ($rootScope.activePipeline||{}).name
    });
  };

  $scope.setPipeline = function() {
    var p = $scope.gMdl.activeVisualPipeline;
    if(p == '') $scope.activeVisual.pipelineName = null;
    else if(p == 'vdeNewPipeline') {
      var pipeline = new vde.Vis.Pipeline();
      $scope.activeVisual.pipelineName = pipeline.name
      $rootScope.activePipeline = pipeline;
      $scope.gMdl.activeVisualPipeline = pipeline.name;
    }
    else {
      $scope.activeVisual.pipelineName = p;
      $rootScope.activePipeline = vde.Vis.pipelines[p];
    }

    vde.Vis.parse().then(function() {
      logger.log('set_pipeline', {
        activeVisual: $rootScope.activeVisual.name,
        activeLayer: $rootScope.activeLayer.name,
        activeVisualPipeline: p,
        activePipeline: $rootScope.activePipeline.name
      }, true, true);

      timeline.save();
    });
  };

  $scope.addGroup = function() {
    var g = new vde.Vis.marks.Group();
    vde.Vis.parse().then(function() {
      $rootScope.activeGroup = $rootScope.activeLayer = g;
      $rootScope.activeVisual = g;

      logger.log('new_group', {
        activeVisual: g.name,
        activeLayer: g.layerName || g.name,
        visualPipeline: g.pipelineName,
        activePipeline: $rootScope.activePipeline.name
      }, true);

      timeline.save();
    });
  };

  $scope.addAxis = function(group) {
    var axis = new vde.Vis.Axis('', group.isLayer() ? group.name : group.group().name,
        !group.isLayer() ? group.name : null);
    $rootScope.activeVisual = axis;

    logger.log('new_axis', {
      activeVisual: axis.name,
      activeLayer: axis.layerName || axis.name,
      visualPipeline: axis.pipelineName,
      activePipeline: $rootScope.activePipeline.name
    }, true);

    timeline.save();
  };

  $rootScope.removeVisual = function(type, name, group) {
    var cnf = confirm("Are you sure you wish to delete this visual element?")
    if(!cnf) return;

    if(type == 'group') {
      if(vde.iVis.activeMark == vde.Vis.groups[name]) vde.iVis.activeMark = null;
      vde.Vis.groups[name].destroy();
      delete vde.Vis.groups[name];

      var go = vde.Vis.groupOrder;
      go.splice(go.indexOf(name), 1);
    } else {
      if(vde.iVis.activeMark == group[type][name]) vde.iVis.activeMark = null;
      group[type][name].destroy();
      delete group[type][name];

      if(type == 'marks') {
        var mo = group.markOrder;
        mo.splice(mo.indexOf(name), 1);
      }
    }

    vde.Vis.parse().then(function() {
      $('.tooltip').remove();

      logger.log('remove_visual', {
        type: type,
        name: name,
        activeLayer: $rootScope.activeLayer.name,
        activePipeline: $rootScope.activePipeline.name
      }, true);

      timeline.save();
    });
  };

  $scope.newTransform = function(type) {
    var t = new vde.Vis.transforms[type]($rootScope.activeVisual.pipelineName);
    $rootScope.activeVisual.pipeline().transforms.push(t);
    $scope.gMdl.showTransforms = false;

    timeline.save();
  };

  $scope.removeTransform = function(i) {
    var cnf = confirm("Are you sure you wish to delete this transformation?")
    if(!cnf) return;

    $rootScope.activeVisual.pipeline().transforms[i].destroy();
    $rootScope.activeVisual.pipeline().transforms.splice(i, 1);
    vde.Vis.parse().then(function() {
      $('.tooltip').remove();

      logger.log('remove_transform', { idx: i }, false, true);

      timeline.save();
    });
  };

  $scope.toggleProp = function(prop, value) {
    var v = $rootScope.activeVisual,
        p = v.properties[prop] || (v.properties[prop] = {});
    if(p.value == value) delete p.value;
    else p.value = value;

    v.checkExtents(prop);
    v.update(prop);
  };
});

vde.App.controller('EditVisCtrl', function($scope) {
  $scope.vis = vde.Vis.properties;
});

vde.App.controller('GroupCtrl', function($scope, $rootScope) {
  $rootScope.$watch('groupOrder', function() {
    $scope.group = vde.Vis.groups[$scope.layerName];
  });

  $rootScope.$watch(function($scope) {
    return {
      activeVisual: ($scope.activeVisual||{}).name,
      activeGroup: ($scope.activeGroup||{}).name,
      activeLayer: ($scope.activeLayer||{}).name
    };
  }, function() {
    $scope.boundExtents = {};
  }, true)

  $scope.xExtents = [{label: 'Start', property: 'x'},
    {label: 'Width', property: 'width'}, {label: 'End', property: 'x2'}];

  $scope.yExtents = [{label: 'Start', property: 'y'},
    {label: 'Height', property: 'height'}, {label: 'End', property: 'y2'}];
});

vde.App.controller('MarkCtrl', function($scope, $rootScope) {
  $scope.$watch('group.marksOrder', function() {
    $scope.mark = $scope.group.marks[$scope.markName];
    if($scope.mark.type == 'group') $scope.group = $scope.mark;
    else $scope.group = $scope.mark.group();
  });

  $scope.$watch('mark.pipelineName', function() {
    $scope.pipeline = $scope.mark.pipeline();
  });

  $scope.click = function(mark) {
    $rootScope.toggleVisual(mark);
    $scope.gMdl.activeVisualPipeline = $scope.mark.pipelineName || ''
  };
})