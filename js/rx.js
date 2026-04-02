var Rx = {
    /**
     * Creates a grid set.
     * @param xMin integer 
     * @param yMin integer 
     * @param xMax integer 
     * @param yMax integer 
     * @param xCell integer
     * @param yCell integer
     * @returns Raphael set
     *
     * Example usage: Rx.grid(paper, 0, 0, 400, 400, 20, 20).attr("stroke","#aaa");
     */
    grid: function (paper, xMin, yMin, xMax, yMax, xCell, yCell) {
        var st = paper.set();
        for (var y = yMin; y <= yMax; y += yCell) {
            st.push(paper.path("M" + xMin + " " + y + " L" + xMax + " " + y));
        }
        for (var x = xMin; x <= xMax; x += xCell) {
            st.push(paper.path("M" + x + " " + yMin + "L" + x + " " + yMax));
        }
        return st;
    },
    vector: function (paper, x, y, dx, dy) {
        var st = paper.set();
        var def = "M" + x + " " + y + " L" + (x + dx) + " " + (y + dy);
        st.push(paper.circle(x, y, 3).attr("fill", "#666"));
        st.push(paper.path(def));
        return st;
    },
	/* dragging Raphael element... */
	makeDraggable: function (c) {
		var drag = {
			x: 0,
			y: 0,
			state: false
		};
		c.attr('fill', '#80f');
		$(c.node).mousedown(function (e) {
			if (!drag.state) {
				c.attr({
					fill: '#808'
				});
				drag.x = e.pageX;
				drag.y = e.pageY;
				drag.state = true;
			}
			return false;
		});

		$(c.node).mousemove(function (e) {
			if (drag.state) {
				c.translate(e.pageX - drag.x, e.pageY - drag.y);
				drag.x = e.pageX;
				drag.y = e.pageY;
			}
		});

		$(c.node).mouseup(function () {
			c.attr({
				fill: '#80f'
			});
			drag.state = false;
		});

		$(c.node).mouseout(function () {
			$(c.node).mouseup();
		});
	}
	
};
