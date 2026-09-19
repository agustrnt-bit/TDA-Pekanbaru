"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

type Props = {
  file: File;
  onCancel: () => void;
  onApply: (file: File) => void;
};

export function PhotoCropEditor({file,onCancel,onApply}:Props) {
  const frameRef=useRef<HTMLDivElement>(null);
  const imgRef=useRef<HTMLImageElement>(null);
  const pointersRef=useRef(new Map<number,{x:number;y:number}>());
  const pinchRef=useRef<{distance:number;zoom:number}|null>(null);

  const [src,setSrc]=useState("");
  const [zoom,setZoom]=useState(1);
  const [x,setX]=useState(0);
  const [y,setY]=useState(0);
  const [drag,setDrag]=useState<{x:number;y:number}|null>(null);
  const [baseSize,setBaseSize]=useState({w:0,h:0});

  useEffect(()=>{
    const url=URL.createObjectURL(file);
    setSrc(url);
    return()=>URL.revokeObjectURL(url);
  },[file]);

  function fitPhoto() {
    const frame=frameRef.current, img=imgRef.current;
    if(!frame || !img || !img.naturalWidth)return;
    const scale=Math.min(
      frame.clientWidth/img.naturalWidth,
      frame.clientHeight/img.naturalHeight,
      1
    );
    setBaseSize({w:img.naturalWidth*scale,h:img.naturalHeight*scale});
    setZoom(1); setX(0); setY(0);
  }

  function changeZoom(v:number) {
    setZoom(Math.min(5,Math.max(1,v)));
  }

  function pointerDistance() {
    const p=[...pointersRef.current.values()];
    if(p.length<2)return 0;
    return Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);
  }

  function startDrag(e:ReactPointerEvent) {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointersRef.current.size===1)setDrag({x:e.clientX-x,y:e.clientY-y});
    if(pointersRef.current.size===2){
      pinchRef.current={distance:pointerDistance(),zoom};
      setDrag(null);
    }
  }

  function moveDrag(e:ReactPointerEvent) {
    if(!pointersRef.current.has(e.pointerId))return;
    pointersRef.current.set(e.pointerId,{x:e.clientX,y:e.clientY});

    if(pointersRef.current.size>=2 && pinchRef.current){
      changeZoom(pinchRef.current.zoom*(pointerDistance()/pinchRef.current.distance));
    } else if(drag){
      setX(e.clientX-drag.x);
      setY(e.clientY-drag.y);
    }
  }

  function stopDrag(e:ReactPointerEvent) {
    pointersRef.current.delete(e.pointerId);
    pinchRef.current=null;
    setDrag(null);
  }

  function resetPhoto(){
    setZoom(1); setX(0); setY(0);
  }

  async function applyPhoto() {
    const frame=frameRef.current, img=imgRef.current;
    if(!frame || !img)return;

    const fr=frame.getBoundingClientRect();
    const ir=img.getBoundingClientRect();
    const canvas=document.createElement("canvas");
    canvas.width=1600; canvas.height=1200;

    const ctx=canvas.getContext("2d")!;
    ctx.fillStyle="#f8fafc";
    ctx.fillRect(0,0,1600,1200);

    const sx=1600/fr.width;
    const sy=1200/fr.height;

    ctx.drawImage(
      img,
      (ir.left-fr.left)*sx,
      (ir.top-fr.top)*sy,
      ir.width*sx,
      ir.height*sy
    );

    const blob=await new Promise<Blob>((resolve,reject)=>
      canvas.toBlob(
        b=>b?resolve(b):reject(new Error("Foto gagal diproses.")),
        "image/jpeg",
        0.82
      )
    );

    onApply(new File([blob],"foto-tda.jpg",{type:"image/jpeg"}));
  }

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div
        ref={frameRef}
        className="relative aspect-[4/3] w-full touch-none overflow-hidden rounded-2xl bg-slate-100"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        {src ? (
          <img
            ref={imgRef}
            src={src}
            alt="Atur posisi foto"
            draggable={false}
            onLoad={fitPhoto}
            className="absolute left-1/2 top-1/2 max-w-none select-none"
            style={{
              width:baseSize.w||undefined,
              height:baseSize.h||undefined,
              transform:`translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) scale(${zoom})`,
            }}
          />
        ) : null}
      </div>

      <div className="mt-4">
        <div className="text-center text-xs leading-5 text-slate-500">
          <p className="md:hidden">
            Geser dengan 1 jari untuk mengatur posisi • Cubit dengan 2 jari untuk zoom
          </p>
          <p className="hidden md:block">
            Klik dan geser foto untuk mengatur posisi • Gunakan − / + atau slider untuk zoom
          </p>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={()=>changeZoom(zoom-0.1)}
            className="h-10 w-10 rounded-xl border bg-white text-lg font-bold"
          >
            −
          </button>

          <input
            type="range"
            min="1"
            max="5"
            step="0.05"
            value={zoom}
            onChange={e=>changeZoom(Number(e.target.value))}
            className="w-full"
          />

          <button
            type="button"
            onClick={()=>changeZoom(zoom+0.1)}
            className="h-10 w-10 rounded-xl border bg-white text-lg font-bold"
          >
            +
          </button>
        </div>

        <div className="mt-4 flex flex-wrap justify-between gap-2">
          <button
            type="button"
            onClick={resetPhoto}
            className="rounded-xl border px-4 py-2 text-sm font-semibold"
          >
            Reset
          </button>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border px-4 py-2 text-sm font-semibold"
            >
              Batal
            </button>

            <button
              type="button"
              onClick={applyPhoto}
              className="rounded-xl bg-emerald-800 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-900"
            >
              Gunakan Foto
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
