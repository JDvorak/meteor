var size = 24;
Zone = new Meteor.Collection("area");
Entity = new Meteor.Collection("entity");
Types = {
  nilZoid:    {img: '', obstacle: false},
  wall:       {img: '█', obstacle: true},
  breakWall:  {img: '▓', obstacle: true},
  player:     {img: '☺', obstacle: true},
  deadPlayer: {img: '☠', obstacle: false},
  teleporter: {img: '⏚', obstacle: false},
  bomb:       {img: 'ό', obstacle: false},
  explosion:  {img: '✺', obstacle: false}
};

if (Meteor.isClient) {
  Meteor.startup(function() {
    var randomX  = Math.floor((Math.random() * size-1)+1),
        randomY  = Math.floor((Math.random() * size-1)+1);

    Entity.insert({PositionX: randomX,
                   PositionY: randomY,
                   mobType: 'player',
                   bombs: 1},
      function(_err, _id) {
        Session.set("id", _id);
        initControls();
        $(window).on('unload', function() {
          Entity.remove(_id);
      });
    });
});

  Template.gameDisplay.helpers({
    Cells: function(){
      return Zone.find({}).fetch();
    },
    EntityGraphic: function(id){
      if (!Entity.findOne(id)) return;
      return Types[Entity.findOne(id).mobType].img
    }
  });

  var initControls = function() {
    var left    = 37,
        up      = 38,
        right   = 39,
        down    = 40,
        space   = 32,
        player  = Session.get("id"),
        move;

    $(document).on('keyup', function(e) {
      switch (e.keyCode) {
        case left:
          move = { 'PositionX' : -1, 'PositionY' : 0 };
          break;
        case up:
          move = { 'PositionX' : 0, 'PositionY' : 1 };
          break;
        case right:
          move = { 'PositionX' : 1, 'PositionY' : 0 };
          break;
        case down:
          move = { 'PositionX' : 0,  'PositionY' : -1 };
          break;
        case space:
          move = {};
          Meteor.call('dropBomb', player)
          break;
        default:
          move = {};
          break;
      }
      Entity.update(player, {$inc: move});
    });
  };
}

if (Meteor.isServer) {
  Zone.remove({});
  Entity.remove({});
  Entity.insert({_id:"nilZoid", mobType: 'nilZoid'})

  Meteor.methods({
    dropBomb: function(id) {
       if (Entity.findOne(id).bombs > 0) {
         Zone.update({occupant: id}, {$set: {placedBomb: true, bomberPlacer: id}})
         Entity.update(id, {$inc: {bombs: -1}})
       }
    }
  })

  Meteor.startup(function () {
    var newOccupant, newMob;
    for (var i = 0; i <= size; i++) {
      for (var j = 0; j <= size; j++) {
        if (i === 0 || i === size || j === 0 || j === size) {
          newMob = 'wall'
          newOccupant = Entity.insert({PositionX: i, PositionY: j, mobType: 'wall'});
        } else if ((j % 3 && i % 3) || ( i % 11 === j % 11)) {
          newOccupant = Entity.insert({PositionX: i, PositionY: j, mobType: 'breakWall'});
          newMob = 'breakWall'
        } else {
          newMob = 'nilZoid'
          newOccupant = 'nilZoid';
        }

          Zone.insert({LocationX: i,
                       LocationY: j,
                       occupant: newOccupant,
                       mobType: newMob});
      }
    }

    Entity.find({})
          .observeChanges({
            added: syncEntityZone,
            changed: syncEntityZone,
            removed: syncEntityZone
          });
  });

 var syncEntityZone = function(id, fields){

    if (fields === undefined) return;
    var mobile  = Entity.findOne(id),
        newType = mobile.mobType,
        present = Zone.findOne({occupant: id}),
        future  = Zone.findOne({LocationX: mobile.PositionX, LocationY: mobile.PositionY});

    if (
         (!!future && !!present)
      && ((Types[future.mobType].obstacle)
      || (Math.abs(present.LocationX - future.LocationX) > 1)
      || (Math.abs(present.LocationY - future.LocationY) > 1))
      )
    {
      Entity.update(id, {$set: {PositionX: present.LocationX,
                                PositionY: present.LocationY}})
    } else {
      if (!!present && present.placedBomb) {
        var newEntity = Entity.insert({PositionX: present.LocationX,
                                       PositionY: present.LocationY,
                                       mobType: "bomb"});
        Zone.update({occupant: id}, {$set: {occupant: newEntity, mobType: "bomb"}},
          Meteor.setTimeout(function(){
            explode(newEntity);
          }, 3000));
      } else {
        Zone.update({occupant: id}, {$set: {occupant: "nilZoid", mobType: "nilZoid"}});
      }
      Zone.update(
        { LocationX: mobile.PositionX,
          LocationY: mobile.PositionY },
        { $set: {occupant: id, mobType: newType}});
    }

  var explode = function(id) {
    var present = Zone.findOne({occupant: id});

    Zone.update({$or: [
          {LocationX: {$gt: present.LocationX-2, $lt: present.LocationX+2},
          {LocationY: {$gt: present.LocationY-2, $lt: present.LocationY+2}
          ]
        }, {$set: {occupant: "explosion", mobType: "explosion"} })
  }

  };

}
