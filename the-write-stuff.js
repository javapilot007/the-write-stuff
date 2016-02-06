Counts = new Mongo.Collection("counts");
 
if (Meteor.isServer) {
  // This code only runs on the server
  // Only publish counts that are public or belong to the current user
  Meteor.publish("counts", function () {
    return Counts.find({
      $or: [
        { private: {$ne: true} },
        { owner: this.userId }
      ]
    });
  });
}

if (Meteor.isClient) {
  // This code only runs on the client
  Meteor.subscribe("counts");
 
  var myLineChart = null;
 
  function formatDate(date) {
	  return moment(date).format('YYYY-MM-DD');
  }
 
  function redrawLineChart() {
	for (i in myLineChart.datasets[0].points) {
       myLineChart.removeData();
	}
	myLineChart.removeData();
//	for (count in Counts.find({}, {sort: {countedAt: -1}})) {
//	   myLineChart.addData([count.count, count.count], formatDate(count.countedAt));
//	}
	var myCounts = Counts.find({}, {sort: {countedAt: -1}});
//	myCounts.forEach(function(myCount) {
//		myLineChart.addData([myCount.count, myCount.count], formatDate(myCount.countedAt));
//	});
	for (i = 1; i <= 3; i++) {
		j = i * 100;
		k = i * 75;
		myLineChart.addData([j, k], i);
	}
	myLineChart.update();
  }
 
  Template.registerHelper('formatDate', function(date) {
    return formatDate(date);
  });

  Template.body.helpers({
    counts: function () {
      if (Session.get("hideCompleted")) {
        // If hide completed is checked, filter counts
        return Counts.find({checked: {$ne: true}}, {sort: {countedAt: -1}});
      } else {
        // Otherwise, return all of the counts, showing the newest counts at the top
        return Counts.find({}, {sort: {countedAt: -1}});
      }
    },
    hideCompleted: function () {
      return Session.get("hideCompleted");
    },
    incompleteCount: function () {
      return Counts.find({checked: {$ne: true}}).count();
     }
  });
 
  Template.body.events({
    "submit .new-count": function (event) {
      // Prevent default browser form submit
      event.preventDefault();
 
      // Get values from form element
	  var date = event.target.date.value;
      var num = event.target.num.value;
 
      // Insert a count into the collection
      Meteor.call("addCount", date, num);
	  redrawLineChart();
	  
      // Clear form
	  event.target.date.value = "";
      event.target.num.value = "";
    },
    "change .hide-completed input": function (event) {
      Session.set("hideCompleted", event.target.checked);
    }
  });

  Template.count.helpers({
    isOwner: function () {
      return this.owner === Meteor.userId();
    }
  });  
 
  Template.count.events({
    "click .toggle-checked": function () {
      // Set the checked property to the opposite of its current value
      Meteor.call("setChecked", this._id, ! this.checked);
    },
    "click .delete": function () {
      Meteor.call("deleteCount", this._id);
	  redrawLineChart();
    },
    "click .toggle-private": function () {
      Meteor.call("setPrivate", this._id, ! this.private);
    }
  });

  Template.charts.onRendered(function() {
	// Get the context of the canvas element we want to select
	var ctx  = document.getElementById("myChart").getContext("2d");

	var data = {
		labels: ["2016-01-01", "2016-01-02", "2016-01-03"],
		datasets: [
			{
				label: "My Counts",
				fillColor: "rgba(220,220,220,0.2)",
				strokeColor: "rgba(220,220,220,1)",
				pointColor: "rgba(220,220,220,1)",
				pointStrokeColor: "#fff",
				pointHighlightFill: "#fff",
				pointHighlightStroke: "rgba(220,220,220,1)",
				data: [4135, 3200, 2053]
			},
			{
				label: "Their Counts",
				fillColor: "rgba(151,187,205,0.2)",
				strokeColor: "rgba(151,187,205,1)",
				pointColor: "rgba(151,187,205,1)",
				pointStrokeColor: "#fff",
				pointHighlightFill: "#fff",
				pointHighlightStroke: "rgba(151,187,205,1)",
				data: [5326, 1560, 4326]
			}
		]
	};

//	var myCounts = Counts.find({}, {sort: {countedAt: -1}});
//	var i = 0;
//	myCounts.forEach(function (myCount) {
//		myLineChart.addData([myCount.count, myCount.count], formatDate(myCount.countedAt));
//		data.labels[i] = formatDate(myCount.countedAt);
//		data.datasets[0].data[i] = 1000;
//		data.datasets[1].data[i] = 600;
//		i += 1;
//	});
//	myLineChart.update();

	// draw the charts
	myLineChart = new Chart(ctx).Line(data,{
		// Boolean - whether or not the chart should be responsive and resize when the browser does.
		responsive: true,
		//String - A legend template
		legendTemplate : "<ul class=\"<%=name.toLowerCase()%>-legend\"><% for (var i=0; i<datasets.length; i++){%><li><span style=\"background-color:<%=datasets[i].strokeColor%>\"></span><%if(datasets[i].label){%><%=datasets[i].label%><%}%></li><%}%></ul>"
	});

	redrawLineChart();
  });

  Accounts.ui.config({
    passwordSignupFields: "USERNAME_AND_OPTIONAL_EMAIL"
  });
}

Meteor.methods({
  addCount: function (date, num) {
    // Make sure the user is logged in before inserting a count
    if (! Meteor.userId()) {
      throw new Meteor.Error("not-authorized");
    }
 
    Counts.insert({
      count: num,						// count
	  countedAt: new Date(date+";"),	// date of count
      createdAt: new Date(), 			// current time
      owner: Meteor.userId(),           // _id of logged in user
      username: Meteor.user().username  // username of logged in user
    });
  },
  deleteCount: function (countId) {
    var count = Counts.findOne(countId);
    if (count.private && count.owner !== Meteor.userId()) {
      // If the count is private, make sure only the owner can delete it
      throw new Meteor.Error("not-authorized");
    }
    Counts.remove(countId);
  },
  setChecked: function (countId, setChecked) {
    var count = Counts.findOne(countId);
    if (count.private && count.owner !== Meteor.userId()) {
      // If the count is private, make sure only the owner can check it off
      throw new Meteor.Error("not-authorized");
    }
    Counts.update(countId, { $set: { checked: setChecked} });
  },
  setPrivate: function (countId, setToPrivate) {
    var count = Counts.findOne(countId);
 
    // Make sure only the count owner can make a count private
    if (count.owner !== Meteor.userId()) {
      throw new Meteor.Error("not-authorized");
    }
 
    Counts.update(countId, { $set: { private: setToPrivate } });
  }
});
