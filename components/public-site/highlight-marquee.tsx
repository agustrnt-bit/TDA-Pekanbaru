"use client";

import { useEffect, useState } from "react";

export function HighlightMarquee({
  items,
  variant,
}: {
  items:any[];
  variant:"business"|"testimonial";
}) {
  const [active,setActive]=useState(0);

  useEffect(()=>{
    setActive(0);
    if(items.length<2) return;

    const id=window.setInterval(()=>{
      setActive(v=>(v+1)%items.length);
    },4500);

    return()=>window.clearInterval(id);
  },[items.length]);

  if(!items.length) {
    return (
      <div className="mt-8 rounded-2xl border border-dashed p-8 text-center text-sm text-slate-500">
        Belum ada konten yang dipublikasikan.
      </div>
    );
  }

  const hero=items[active%items.length];
  const loop=items.length>1?[...items,...items]:items;
  const image=(x:any,type:string)=>
    `/api/public/member-content/image?id=${x.id}&type=${type}`;

  return (
    <div className="tda-showcase -mx-8 mt-10 overflow-hidden md:-mx-[6%]">
      <div className="flex items-stretch gap-5 pl-8 md:pl-[6%]">
        <article className="w-[78vw] max-w-[440px] shrink-0 overflow-hidden rounded-[28px] border bg-white shadow-xl">
          <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
            <img
              src={image(hero,variant==="business"?"business":"profile")}
              className={
                variant==="business"
                  ? "h-full w-full bg-slate-50 object-contain object-center p-3"
                  : "h-full w-full object-cover object-center"
              }
              alt=""
            />
            {variant==="business" ? (
              <img
                src={image(hero,"logo")}
                className="absolute bottom-4 left-4 h-16 w-16 rounded-2xl border bg-white object-contain p-2 shadow-md"
                alt="Logo usaha"
                onError={e=>e.currentTarget.classList.add("hidden")}
              />
            ) : null}
          </div>
          <div className="p-6">
            <h3 className="text-2xl font-bold">
              {variant==="business" ? hero.businessName : hero.memberName}
            </h3>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              {variant==="business" ? hero.businessDescription : `“${hero.testimonial}”`}
            </p>
          </div>
        </article>

        <div className="min-w-0 flex-1 overflow-hidden">
          <div className={`flex w-max gap-4 ${items.length>1?"tda-showcase-track":""}`}>
            {loop.map((x:any,i:number)=>(
              <article key={`${x.id}-${i}`} className="w-[250px] shrink-0 overflow-hidden rounded-2xl border bg-white shadow-sm">
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
                  <img
                    src={image(x,variant==="business"?"business":"profile")}
                    className={
                      variant==="business"
                        ? "h-full w-full bg-slate-50 object-contain object-center p-2"
                        : "h-full w-full object-cover object-center"
                    }
                    alt=""
                  />
                  {variant==="business" ? (
                    <img
                      src={image(x,"logo")}
                      className="absolute bottom-3 left-3 h-11 w-11 rounded-xl border bg-white object-contain p-1 shadow"
                      alt="Logo usaha"
                      onError={e=>e.currentTarget.classList.add("hidden")}
                    />
                  ) : null}
                </div>
                <div className="p-4">
                  <h4 className="font-bold">{variant==="business" ? x.businessName : x.memberName}</h4>
                  <p className="mt-2 max-h-16 overflow-hidden text-sm text-slate-500">
                    {variant==="business" ? x.businessDescription : `“${x.testimonial}”`}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
