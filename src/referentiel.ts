import { multiply, matrix, inv, identity, type Matrix } from 'mathjs';
class Referentiel {
  reference: Node;
  offsetParent: Node | null;
  constructor(reference: Node, offsetParent: Node | null = null) {
    this.reference = reference;
    this.offsetParent = offsetParent;
  }


  static convertPointFromPageToNode(node: Node, point: [number, number]) {
    const referenciel = new Referentiel(node);
    return referenciel.convertPointFromPageToNode(point);
  }

  convertPointFromPageToNode(point: [number, number]): [number, number] {
    return this.globalToLocal(point);
  }

  globalToLocal(point: [number, number]): [number, number] {
    return this._multiplyPoint(this.matrixInv(), point);
  }

  localToGlobal(point: [number, number]) : [number, number] {
    return this._multiplyPoint(this.matrix(), point);
  }

  _multiplyPoint(m: Matrix, point: [number, number]): [number, number] {
    const res = multiply(m, matrix([point[0], point[1], 1])).toArray();
    const [a, b] = res;
    if(!a || !b) throw new Error('Oh no !')
    return [parseFloat(a.toString()), parseFloat(b.toString())];
  }

  _export(value: number): number {
    return this._round(value);
  }

  _round(value: number): number {
    const precision = 1000000.0;
    return Math.round(precision * value) / precision;
  }

  matrixInv(): Matrix {
    return inv(this.matrix());
  }

  matrix(): Matrix {
    const matrixLocale = this.matrixLocale();
    if (this.css('position') === 'fixed') {
      return matrixLocale;
    }
    const parent = this.parent(this.reference);
    if (parent) {
      return multiply(
        new Referentiel(
          parent,
          Referentiel.offsetParent(this.reference)
        ).matrix(),
        matrixLocale
      );
    }
    return matrixLocale;
  }

  static offsetParent(node: Node): Node | null {
    if (node instanceof HTMLElement) {
      return node.offsetParent;
    }
    return null;
  }

  matrixLocale(): Matrix{
    return Referentiel.mult(
      this.matrixSVGViewbox(),
      this.matrixOffset(),
      this.matrixTransformOrigin(),
      this.matrixTransform(),
      inv(this.matrixTransformOrigin()),
      this.matrixBorder()
    );
  }

  matrixTransform(): Matrix {
    if (!(this.reference instanceof HTMLElement)) {
      return Referentiel.identity();
    }
    let transform = this.reference.getAttribute('transform') || 'none';
    if (!transform.match(/^matrix\((.*)\)$/)) {
      transform = this.reference.style.transform;
    }
    if (!transform.match(/^matrix\((.*)\)$/)) {
      transform = this.css('transform');
    }
    const res = transform.match(/^matrix\((.*)\)$/);
    if (!res || !res[1]) {
      return Referentiel.identity();
    }
    const floatsStr = res[1]
      .replace(',', ' ')
      .replace('  ', ' ')
      .split(' ')
    if(floatsStr.length != 6) throw new Error('Transform matrix error');
    const floats = floatsStr.map(function (e) {
        return parseFloat(e);
      }) as [number, number, number, number, number, number]; //! TODO We should do better here.
    return matrix([
      [floats[0], floats[2], floats[4]],
      [floats[1], floats[3], floats[5]],
      [0, 0, 1],
    ]);
  }

  matrixTransformOrigin(): Matrix {
    const transformOriginAttr = this.css('transform-origin')
      .replace(/px/g, '')
      .split(' ')
      .map(function (v) {
        return parseFloat(v) || 0;
      });
    if(transformOriginAttr.length !== 2) throw new Error('Transform origin parsing error'); //! TODO We should do better here.
    const transformOrigin = transformOriginAttr as [number, number];
    return matrix([
      [1, 0, transformOrigin[0]],
      [0, 1, transformOrigin[1]],
      [0, 0, 1],
    ]);
  }

  matrixBorder(): Matrix {
    const left =
      parseFloat(this.css('border-left-width').replace(/px/g, '')) || 0;
    const top =
      parseFloat(this.css('border-top-width').replace(/px/g, '')) || 0;
    return matrix([
      [1, 0, left],
      [0, 1, top],
      [0, 0, 1],
    ]);
  }

  parent(element: Node): Node | null {
    if (
      element.parentNode != null &&
      element.parentNode !== document.documentElement
    ) {
      return element.parentNode;
    } else {
      return null;
    }
  }

  matrixOffset(): Matrix {
    let [left, top] = this.offset(this.reference);
    switch (this.css('position')) {
      case 'absolute':
        return matrix([
          [1, 0, left],
          [0, 1, top],
          [0, 0, 1],
        ]);
      case 'fixed':
        left += window.pageXOffset;
        top += window.pageYOffset;
        return matrix([
          [1, 0, left],
          [0, 1, top],
          [0, 0, 1],
        ]);
    }
    if (this.offsetParent != null) {
      if (this.offsetParent !== this.reference) {
        [left, top] = [0, 0];
      }
    }
    return matrix([
      [1, 0, left],
      [0, 1, top],
      [0, 0, 1],
    ]);
  }

  matrixSVGViewbox(): Matrix {
    if (!(this.reference instanceof window.SVGElement)) {
      return Referentiel.identity();
    }
    const size: [number, number] = [
      parseFloat(this.css('width').replace(/px/g, '')),
      parseFloat(this.css('height').replace(/px/g, '')),
    ];
    const attr = this.reference.getAttribute('viewBox');
    if (attr == null) {
      return Referentiel.identity();
    }
    const viewBoxAttr = attr
      .replace(',', ' ')
      .replace('  ', ' ')
      .split(' ')
      .map(function (e) {
        return parseFloat(e);
      });
    if(viewBoxAttr.length != 4) throw new Error('Viewbox parsing error');
    const viewBox = viewBoxAttr as [number, number, number, number]; //!TODO find a better way ?
    const scale: [number, number]= [size[0] / viewBox[2], size[1] / viewBox[3]];
    return Referentiel.mult(
      matrix([
        [scale[0], 0, 0],
        [0, scale[1], 0],
        [0, 0, 1],
      ]),
      matrix([
        [1, 0, -viewBox[0]],
        [0, 1, -viewBox[1]],
        [0, 0, 1],
      ])
    );
  }

  offset(element: Node): [number, number] {
    if (
      !(element instanceof HTMLElement && this.reference instanceof HTMLElement)
    ) {
      return [0, 0];
    }
    if (element.offsetLeft != null) {
      return [element.offsetLeft, element.offsetTop];
    }
    const pos = this.reference.getBoundingClientRect();
    const offset: [number, number] = [pos.left, pos.top];
    const parent = this.parent(element);
    if (parent instanceof HTMLElement) {
      const ppos = parent.getBoundingClientRect();
      offset[0] -= ppos.left;
      offset[1] -= ppos.top;
    }
    return offset;
  }

  css(property: string): string {
    /*! TODO ? if (Referentiel.jquery) {
      return Referentiel.jquery(element).css(property);
    } */
    if (this.reference instanceof Element) {
      return window.getComputedStyle(this.reference).getPropertyValue(property);
    }
    return '';
  }

  static mult(...args: Matrix[]): Matrix {
    const [a, b, ...rest] = args;
    if(!a || !b) throw new Error('At least two matrix should be defined');
    return Referentiel.mult(multiply(a, b), ...rest)
  }

  static identity(): Matrix {
    return identity(3) as Matrix;
  }
}

/*function cache(klass: Object, functionName: (...args: never[]) => unknown) {
  const func = klass.prototype[functionName];
  klass.prototype[functionName] = function () {
    this._cache || (this._cache = {});
    if (!this._cache[functionName]) {
      this._cache[functionName] = func.apply(this, arguments);
    }
    return this._cache[functionName];
  };
}

cache(Referentiel, 'matrix');
cache(Referentiel, 'matrixInv');*/

export { Referentiel };